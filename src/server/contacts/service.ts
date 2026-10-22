import "server-only";
import {
  contactState,
  DAILY_CONTACT_REQUESTS,
  type ContactError,
  type ContactState,
} from "@/features/contacts/rules";
import { directKey } from "@/features/messages/rules";
import { Prisma } from "@/generated/prisma/client";
import { getBlockedIds, getCommunityMember } from "@/server/community/members";
import { db } from "@/server/db";
import { getLevels } from "@/server/xp/service";

// Contacts (amis) entre membres du Centre. Chaque fonction reçoit l'userId de
// la session ; la liste de contacts n'est visible que par son propriétaire.

type Fail = { ok: false; error: ContactError };

export type ContactPerson = {
  id: string;
  displayName: string | null;
  username: string | null;
  level: number;
};

async function canWrite(userId: string): Promise<{ ok: true } | Fail> {
  const member = await getCommunityMember(userId);
  if (!member?.joined) return { ok: false, error: "notJoined" };
  if (member.suspendedUntil) return { ok: false, error: "suspended" };
  return { ok: true };
}

async function isBlockedPair(a: string, b: string) {
  const blocked = await getBlockedIds(a);
  return blocked.includes(b);
}

/** Relation entre la personne connectée et quelqu'un d'autre. */
export async function getContactState(
  viewerId: string,
  otherId: string,
): Promise<ContactState> {
  const row = await db.contact.findUnique({
    where: { pairKey: directKey(viewerId, otherId) },
    select: { status: true, requesterId: true },
  });
  return contactState(row, viewerId);
}

/** Identifiants des contacts acceptés (Messagerie : écrire sans demande). */
export async function contactIds(viewerId: string) {
  const rows = await db.contact.findMany({
    where: {
      status: "accepted",
      OR: [{ requesterId: viewerId }, { addresseeId: viewerId }],
    },
    select: { requesterId: true, addresseeId: true },
  });
  return new Set(
    rows.map((row) =>
      row.requesterId === viewerId ? row.addresseeId : row.requesterId,
    ),
  );
}

/** Deux personnes contacts l'une de l'autre ? */
export async function areContacts(a: string, b: string) {
  const row = await db.contact.findUnique({
    where: { pairKey: directKey(a, b) },
    select: { status: true },
  });
  return row?.status === "accepted";
}

/** La demande devient acceptée : leur conversation n'est plus une demande non plus. */
async function acceptPair(contactId: string, a: string, b: string) {
  await db.$transaction(async (tx) => {
    await tx.contact.update({
      where: { id: contactId },
      data: { status: "accepted", respondedAt: new Date() },
    });
    await tx.conversationMember.updateMany({
      where: {
        status: "request",
        conversation: { directKey: directKey(a, b) },
      },
      data: { status: "accepted" },
    });
  });
}

/**
 * Envoie une demande de contact. Si l'autre personne en avait déjà envoyé une,
 * vous devenez contacts tout de suite.
 */
export async function requestContact(
  viewerId: string,
  otherId: string,
): Promise<{ ok: true; state: ContactState } | Fail> {
  if (viewerId === otherId) return { ok: false, error: "notFound" };
  const allowed = await canWrite(viewerId);
  if (!allowed.ok) return allowed;
  const other = await getCommunityMember(otherId);
  if (!other?.joined) return { ok: false, error: "notFound" };
  if (await isBlockedPair(viewerId, otherId)) {
    return { ok: false, error: "blocked" };
  }

  const pairKey = directKey(viewerId, otherId);
  const existing = await db.contact.findUnique({
    where: { pairKey },
    select: { id: true, status: true, requesterId: true },
  });
  const state = contactState(existing, viewerId);
  if (existing && state === "received") {
    await acceptPair(existing.id, viewerId, otherId);
    return { ok: true, state: "contact" };
  }
  if (state !== "none") return { ok: true, state };

  const recent = await db.contact.count({
    where: {
      requesterId: viewerId,
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  });
  if (recent >= DAILY_CONTACT_REQUESTS) {
    return { ok: false, error: "contactLimit" };
  }
  try {
    await db.contact.create({
      data: { requesterId: viewerId, addresseeId: otherId, pairKey },
    });
  } catch (error) {
    // Les deux personnes ont envoyé leur demande en même temps
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { ok: true, state: await getContactState(viewerId, otherId) };
    }
    throw error;
  }
  return { ok: true, state: "sent" };
}

/** Accepte ou refuse une demande reçue (refuser la retire, sans prévenir). */
export async function respondToContact(
  viewerId: string,
  otherId: string,
  accept: boolean,
) {
  const row = await db.contact.findFirst({
    where: {
      pairKey: directKey(viewerId, otherId),
      addresseeId: viewerId,
      status: "pending",
    },
    select: { id: true },
  });
  if (!row) return false;
  if (!accept) {
    await db.contact.delete({ where: { id: row.id } });
    return true;
  }
  if (!(await canWrite(viewerId)).ok) return false;
  if (await isBlockedPair(viewerId, otherId)) return false;
  await acceptPair(row.id, viewerId, otherId);
  return true;
}

/** Retire un contact, ou annule sa propre demande. */
export async function removeContact(viewerId: string, otherId: string) {
  const { count } = await db.contact.deleteMany({
    where: {
      pairKey: directKey(viewerId, otherId),
      OR: [{ status: "accepted" }, { requesterId: viewerId }],
    },
  });
  return count > 0;
}

/** Contacts, demandes reçues et demandes envoyées (personnes bloquées exclues). */
export async function listContacts(viewerId: string) {
  const blocked = new Set(await getBlockedIds(viewerId));
  const rows = await db.contact.findMany({
    where: { OR: [{ requesterId: viewerId }, { addresseeId: viewerId }] },
    orderBy: { createdAt: "desc" },
    take: 500,
    select: {
      status: true,
      requesterId: true,
      addresseeId: true,
    },
  });
  const visible = rows.filter(
    (row) =>
      !blocked.has(
        row.requesterId === viewerId ? row.addresseeId : row.requesterId,
      ),
  );
  const otherOf = (row: (typeof rows)[number]) =>
    row.requesterId === viewerId ? row.addresseeId : row.requesterId;
  const ids = visible.map(otherOf);
  const [profiles, levels] = await Promise.all([
    db.profile.findMany({
      where: { id: { in: ids } },
      select: { id: true, displayName: true, username: true },
    }),
    getLevels(ids),
  ]);
  const byId = new Map(
    profiles.map((profile) => [
      profile.id,
      { ...profile, level: levels.get(profile.id) ?? 1 },
    ]),
  );
  const group = (state: ContactState) =>
    visible
      .filter((row) => contactState(row, viewerId) === state)
      .flatMap((row) => byId.get(otherOf(row)) ?? [])
      .sort((a, b) =>
        (a.displayName ?? a.username ?? "").localeCompare(
          b.displayName ?? b.username ?? "",
          "fr",
        ),
      );
  return {
    contacts: group("contact"),
    received: group("received"),
    sent: group("sent"),
  };
}

/** Demandes de contact reçues en attente (pastille de la Messagerie). */
export async function countContactRequests(viewerId: string) {
  return db.contact.count({
    where: { addresseeId: viewerId, status: "pending" },
  });
}
