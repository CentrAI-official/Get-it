import "server-only";
import { Prisma } from "@/generated/prisma/client";
import {
  canSeePlan,
  CLIENT_LIMITS,
  orderedShares,
  type ClientError,
  type ClientStatus,
  type Shares,
  type ShareableKind,
} from "@/features/clients/rules";
import { sessionOn, planWeek, weekOf } from "@/features/development/calendar";
import { storedPlanSchema } from "@/features/development/plan";
import type { DayMoment } from "@/config/moments";
import { fromDbDate, toCalendarDay, toDbDate } from "@/lib/dates";
import { getBlockedIds, getCommunityMember } from "@/server/community/members";
import { db } from "@/server/db";
import { notify } from "@/server/notifications/service";
import { avatarUrls } from "@/server/profile/avatar";

// Les clients d'une page pro (lot 3). La page est toujours celle de la
// personne connectée (retrouvée par sa session) ; le client décide seul de ce
// qu'elle voit, et chaque lecture de sa fiche revérifie le partage.

type Result<T = object> =
  ({ ok: true } & T) | { ok: false; error: ClientError };

const DAY_MS = 24 * 60 * 60 * 1000;
const since24h = () => new Date(Date.now() - DAY_MS);
const isUnique = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === "P2002";

export type ClientPerson = {
  id: string;
  displayName: string | null;
  username: string | null;
  avatarUrl: string | null;
};

/** Un suivi vu par la page. */
export type PageClientItem = {
  id: string;
  status: ClientStatus;
  initiatedBy: "page" | "client";
  client: ClientPerson;
  sharedKinds: ShareableKind[];
  message: string;
  /** Début du suivi, ou de l'invitation ou de la demande. */
  since: string;
  endedAt: string | null;
};

/** Un suivi vu par le client. */
export type MyProItem = {
  id: string;
  status: Exclude<ClientStatus, "ended">;
  initiatedBy: "page" | "client";
  page: {
    id: string;
    handle: string;
    name: string;
    category: string;
    logoUrl: string | null;
  };
  sharedKinds: ShareableKind[];
  mentalConsent: boolean;
  message: string;
  since: string;
};

const OPEN = ["invited", "requested", "active"] as const;

/** Les identités de plusieurs membres (photo par lien temporaire). */
async function people(ids: string[]): Promise<Map<string, ClientPerson>> {
  const rows = await db.profile.findMany({
    where: { id: { in: ids } },
    select: { id: true, displayName: true, username: true, avatarPath: true },
  });
  const urls = await avatarUrls(rows.map((row) => row.avatarPath));
  return new Map(
    rows.map((row) => [
      row.id,
      {
        id: row.id,
        displayName: row.displayName,
        username: row.username,
        avatarUrl: row.avatarPath ? (urls.get(row.avatarPath) ?? null) : null,
      },
    ]),
  );
}

/** Membre du Centre, pas suspendu : peut inviter, demander ou accepter. */
async function canTakePart(userId: string): Promise<Result> {
  const member = await getCommunityMember(userId);
  if (!member?.joined) return { ok: false, error: "notJoined" };
  if (member.suspendedUntil) return { ok: false, error: "suspended" };
  return { ok: true };
}

/** Le plan mental partagé garde la date de l'accord ; sinon aucun accord. */
const consentOf = (shares: Shares, previous: Date | null = null) =>
  shares.kinds.includes("mental") ? (previous ?? new Date()) : null;

// ——— Côté page ———

/** Les suivis de la page : demandes, clients, invitations, puis anciens clients. */
export async function listPageClients(
  ownerId: string,
  pageId: string,
): Promise<PageClientItem[]> {
  const blocked = await getBlockedIds(ownerId);
  const rows = await db.pageClient.findMany({
    where: {
      pageId,
      page: { ownerId },
      ...(blocked.length > 0 ? { clientId: { notIn: blocked } } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: CLIENT_LIMITS.openPerPage + 50,
    select: {
      id: true,
      status: true,
      initiatedBy: true,
      clientId: true,
      sharedKinds: true,
      message: true,
      acceptedAt: true,
      createdAt: true,
      endedAt: true,
    },
  });
  // Un ancien suivi ne compte pas si la personne est de nouveau suivie
  const open = new Set(
    rows.filter((row) => row.status !== "ended").map((row) => row.clientId),
  );
  const seenEnded = new Set<string>();
  const kept = rows.filter((row) => {
    if (row.status !== "ended") return true;
    if (open.has(row.clientId) || seenEnded.has(row.clientId)) return false;
    seenEnded.add(row.clientId);
    return true;
  });
  const byId = await people([...new Set(kept.map((row) => row.clientId))]);
  const order: Record<ClientStatus, number> = {
    requested: 0,
    active: 1,
    invited: 2,
    ended: 3,
  };
  return kept
    .flatMap((row) => {
      const client = byId.get(row.clientId);
      return client
        ? [
            {
              id: row.id,
              status: row.status,
              initiatedBy: row.initiatedBy === "client" ? "client" : "page",
              client,
              sharedKinds: orderedShares(row.sharedKinds),
              message: row.message,
              since: (row.acceptedAt ?? row.createdAt).toISOString(),
              endedAt: row.endedAt?.toISOString() ?? null,
            } satisfies PageClientItem,
          ]
        : [];
    })
    .sort((a, b) => order[a.status] - order[b.status]);
}

/** Invite un membre du Centre (par son nom d'utilisateur) à devenir client. */
export async function inviteClient(
  ownerId: string,
  pageId: string,
  username: string,
  message: string,
): Promise<Result> {
  const allowed = await canTakePart(ownerId);
  if (!allowed.ok) return allowed;
  const target = await db.profile.findFirst({
    where: { username: { equals: username, mode: "insensitive" } },
    select: { id: true },
  });
  if (!target) return { ok: false, error: "notFound" };
  if (target.id === ownerId) return { ok: false, error: "self" };
  const [member, blocked] = await Promise.all([
    getCommunityMember(target.id),
    getBlockedIds(ownerId),
  ]);
  if (!member?.joined || blocked.includes(target.id)) {
    return { ok: false, error: "notFound" };
  }
  const [invites, open] = await Promise.all([
    db.pageClient.count({
      where: { pageId, initiatedBy: "page", createdAt: { gte: since24h() } },
    }),
    db.pageClient.count({ where: { pageId, status: { in: [...OPEN] } } }),
  ]);
  if (invites >= CLIENT_LIMITS.invitesPerDay) {
    return { ok: false, error: "inviteLimit" };
  }
  if (open >= CLIENT_LIMITS.openPerPage) {
    return { ok: false, error: "clientLimit" };
  }
  try {
    await db.pageClient.create({
      data: {
        pageId,
        clientId: target.id,
        status: "invited",
        initiatedBy: "page",
        message,
      },
    });
  } catch (error) {
    if (isUnique(error)) return { ok: false, error: "already" };
    throw error;
  }
  await notify({
    userId: target.id,
    kind: "client_invite",
    actorId: ownerId,
    actorPageId: pageId,
    href: "/profile/pros",
    groupKey: `client:${pageId}`,
  });
  return { ok: true };
}

/** Accepte (le suivi commence) ou refuse (sans prévenir) une demande. */
export async function respondToClientRequest(
  ownerId: string,
  pageId: string,
  relationId: string,
  accept: boolean,
): Promise<Result> {
  const relation = await db.pageClient.findFirst({
    where: { id: relationId, pageId, page: { ownerId }, status: "requested" },
    select: { clientId: true },
  });
  if (!relation) return { ok: false, error: "notFound" };
  if (!accept) {
    await db.pageClient.delete({ where: { id: relationId } });
    return { ok: true };
  }
  await db.pageClient.update({
    where: { id: relationId },
    data: { status: "active", acceptedAt: new Date() },
  });
  await notify({
    userId: relation.clientId,
    kind: "client_accepted",
    actorId: ownerId,
    actorPageId: pageId,
    href: "/profile/pros",
    groupKey: `client:${pageId}`,
  });
  return { ok: true };
}

/** Retire une invitation pas encore acceptée. */
export async function cancelInvitation(
  ownerId: string,
  pageId: string,
  relationId: string,
) {
  const { count } = await db.pageClient.deleteMany({
    where: { id: relationId, pageId, page: { ownerId }, status: "invited" },
  });
  return count > 0;
}

/** La page met fin au suivi : elle ne voit plus rien (ses notes restent). */
export async function endByPage(
  ownerId: string,
  pageId: string,
  relationId: string,
) {
  const { count } = await db.pageClient.updateMany({
    where: { id: relationId, pageId, page: { ownerId }, status: "active" },
    data: {
      status: "ended",
      endedAt: new Date(),
      sharedKinds: [],
      mentalConsentAt: null,
    },
  });
  return count > 0;
}

// ——— La fiche d'un client ———

export type ClientPlanItem = {
  name: string;
  detail: string;
  done: boolean;
  /** Nutrition : ce qui a été mangé à la place. */
  replacedBy: string | null;
  /** Social : 1 (difficile) à 3 (super bien). */
  outcome: number | null;
};

export type ClientWorkout = {
  day: string;
  title: string;
  minutes: number;
  sets: number;
  records: number;
};

export type ClientPlanDay = {
  day: string;
  today: boolean;
  session: {
    title: string;
    time: number | null;
    moment: DayMoment | null;
    items: ClientPlanItem[];
  } | null;
  /** Entraînement : la séance notée ce jour-là dans le carnet. */
  workout: ClientWorkout | null;
};

export type ClientPlanView = {
  kind: ShareableKind;
  title: string;
  summary: string;
  week: { week: number; weeks: number } | null;
  days: ClientPlanDay[];
  /** Entraînement : les dernières séances terminées du carnet. */
  recent: ClientWorkout[];
};

export type ClientNoteItem = { id: string; body: string; createdAt: string };

export type ClientFile = {
  relationId: string;
  status: ClientStatus;
  client: ClientPerson;
  since: string;
  endedAt: string | null;
  message: string;
  sharedKinds: ShareableKind[];
  /** Les plans partagés qui existent (lecture seule, semaine en cours). */
  plans: ClientPlanView[];
  notes: ClientNoteItem[];
};

/** Les séances terminées du carnet : durée, séries faites, records. */
async function workoutsOf(
  clientId: string,
  where: Prisma.WorkoutSessionWhereInput,
  take: number,
): Promise<ClientWorkout[]> {
  const rows = await db.workoutSession.findMany({
    where: { userId: clientId, finishedAt: { not: null }, ...where },
    orderBy: { day: "desc" },
    take,
    select: {
      day: true,
      title: true,
      startedAt: true,
      finishedAt: true,
      records: true,
      _count: { select: { sets: { where: { done: true } } } },
    },
  });
  return rows.map((row) => ({
    day: fromDbDate(row.day),
    title: row.title,
    minutes: row.finishedAt
      ? Math.max(
          1,
          Math.round(
            (row.finishedAt.getTime() - row.startedAt.getTime()) / 60000,
          ),
        )
      : 0,
    sets: row._count.sets,
    records: Array.isArray(row.records) ? row.records.length : 0,
  }));
}

/**
 * Les plans que le client montre, en lecture seule : la semaine en cours dans
 * son fuseau, ce qu'il a coché et, pour l'entraînement, son carnet. Jamais un
 * montant du budget ni un plan qu'il ne partage pas.
 */
async function sharedPlans(
  clientId: string,
  kinds: ShareableKind[],
): Promise<ClientPlanView[]> {
  if (kinds.length === 0) return [];
  const [settings, rows] = await Promise.all([
    db.userSettings.findUnique({
      where: { userId: clientId },
      select: { timeZone: true },
    }),
    db.developmentPlan.findMany({
      where: { userId: clientId, kind: { in: kinds } },
      select: { kind: true, plan: true, startsOn: true, endsOn: true },
    }),
  ]);
  const today = toCalendarDay(
    new Date(),
    settings?.timeZone ?? "America/Toronto",
  );
  const days = weekOf(today);
  const from = toDbDate(days[0] ?? today);
  const to = toDbDate(days[6] ?? today);
  const [logs, weekWorkouts, recent] = await Promise.all([
    db.planItemLog.findMany({
      where: {
        userId: clientId,
        kind: { in: kinds },
        day: { gte: from, lte: to },
      },
      // Jamais la ligne du budget : seulement ce qui a été fait
      select: {
        kind: true,
        day: true,
        weekday: true,
        position: true,
        replacedBy: true,
        outcome: true,
      },
    }),
    kinds.includes("physical")
      ? workoutsOf(clientId, { day: { gte: from, lte: to } }, 14)
      : Promise.resolve([]),
    kinds.includes("physical")
      ? workoutsOf(clientId, {}, 5)
      : Promise.resolve([]),
  ]);
  const logKey = (
    kind: string,
    day: string,
    weekday: number,
    position: number,
  ) => `${kind}:${day}:${weekday}:${position}`;
  const logged = new Map(
    logs.map((log) => [
      logKey(log.kind, fromDbDate(log.day), log.weekday, log.position),
      log,
    ]),
  );
  return orderedShares(kinds).flatMap((kind) => {
    const row = rows.find((entry) => entry.kind === kind);
    const plan = row ? storedPlanSchema.safeParse(row.plan) : null;
    if (!row || !plan?.success) return [];
    const calendar = {
      startsOn: fromDbDate(row.startsOn),
      endsOn: fromDbDate(row.endsOn),
      schedule: plan.data.schedule,
    };
    return [
      {
        kind,
        title: plan.data.title,
        summary: plan.data.summary,
        week: planWeek(calendar, today),
        days: days.map((day) => {
          const session = sessionOn(
            { id: "", kind, title: "", ...calendar },
            day,
          );
          return {
            day,
            today: day === today,
            session: session
              ? {
                  title: session.title,
                  time: session.time,
                  moment: session.moment,
                  items: session.items.map((item, position) => {
                    const log = logged.get(
                      logKey(kind, day, session.weekday, position),
                    );
                    return {
                      name: item.name,
                      detail: item.detail,
                      done: Boolean(log),
                      replacedBy: log?.replacedBy ?? null,
                      outcome: log?.outcome ?? null,
                    };
                  }),
                }
              : null,
            workout:
              kind === "physical"
                ? (weekWorkouts.find((workout) => workout.day === day) ?? null)
                : null,
          };
        }),
        recent: kind === "physical" ? recent : [],
      },
    ];
  });
}

/**
 * La fiche d'un client pour la page : le suivi (en cours, ou le dernier), ses
 * plans partagés si le suivi est en cours, et les notes du pro. Null si la
 * personne n'a jamais été suivie par la page, ou si l'un a bloqué l'autre.
 */
export async function getClientFile(
  ownerId: string,
  pageId: string,
  clientId: string,
): Promise<ClientFile | null> {
  const [relations, blocked] = await Promise.all([
    db.pageClient.findMany({
      where: { pageId, clientId, page: { ownerId } },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        status: true,
        sharedKinds: true,
        mentalConsentAt: true,
        message: true,
        acceptedAt: true,
        createdAt: true,
        endedAt: true,
      },
    }),
    getBlockedIds(ownerId),
  ]);
  const relation =
    relations.find((row) => row.status !== "ended") ?? relations[0];
  if (!relation || blocked.includes(clientId)) return null;
  const visible = orderedShares(relation.sharedKinds).filter((kind) =>
    canSeePlan(relation, kind),
  );
  const [byId, plans, notes] = await Promise.all([
    people([clientId]),
    sharedPlans(clientId, visible),
    db.clientNote.findMany({
      where: { pageId, clientId },
      orderBy: { createdAt: "desc" },
      take: CLIENT_LIMITS.notesPerClient,
      select: { id: true, body: true, createdAt: true },
    }),
  ]);
  const client = byId.get(clientId);
  if (!client) return null;
  return {
    relationId: relation.id,
    status: relation.status,
    client,
    since: (relation.acceptedAt ?? relation.createdAt).toISOString(),
    endedAt: relation.endedAt?.toISOString() ?? null,
    message: relation.message,
    sharedKinds: visible,
    plans,
    notes: notes.map((note) => ({
      id: note.id,
      body: note.body,
      createdAt: note.createdAt.toISOString(),
    })),
  };
}

/** Une note sur un client que la page suit ou a suivi. */
export async function addClientNote(
  ownerId: string,
  pageId: string,
  clientId: string,
  body: string,
): Promise<Result> {
  const [relation, count] = await Promise.all([
    db.pageClient.count({
      where: {
        pageId,
        clientId,
        page: { ownerId },
        status: { in: ["active", "ended"] },
      },
    }),
    db.clientNote.count({ where: { pageId, clientId } }),
  ]);
  if (relation === 0) return { ok: false, error: "notFound" };
  if (count >= CLIENT_LIMITS.notesPerClient) {
    return { ok: false, error: "noteLimit" };
  }
  await db.clientNote.create({ data: { pageId, clientId, body } });
  return { ok: true };
}

export async function deleteClientNote(
  ownerId: string,
  pageId: string,
  noteId: string,
) {
  const { count } = await db.clientNote.deleteMany({
    where: { id: noteId, pageId, page: { ownerId } },
  });
  return count > 0;
}

// ——— Côté client ———

/** Mes pros : invitations reçues, demandes envoyées et suivis en cours. */
export async function listMyPros(userId: string): Promise<MyProItem[]> {
  const blocked = await getBlockedIds(userId);
  const rows = await db.pageClient.findMany({
    where: {
      clientId: userId,
      status: { in: [...OPEN] },
      ...(blocked.length > 0 ? { page: { ownerId: { notIn: blocked } } } : {}),
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      status: true,
      initiatedBy: true,
      sharedKinds: true,
      mentalConsentAt: true,
      message: true,
      acceptedAt: true,
      createdAt: true,
      page: {
        select: {
          id: true,
          handle: true,
          name: true,
          category: true,
          logoPath: true,
        },
      },
    },
  });
  const urls = await avatarUrls(rows.map((row) => row.page.logoPath));
  const order = { invited: 0, requested: 1, active: 2 } as const;
  return rows
    .flatMap((row) =>
      row.status === "ended"
        ? []
        : [
            {
              id: row.id,
              status: row.status,
              initiatedBy:
                row.initiatedBy === "client"
                  ? ("client" as const)
                  : ("page" as const),
              page: {
                id: row.page.id,
                handle: row.page.handle,
                name: row.page.name,
                category: row.page.category,
                logoUrl: row.page.logoPath
                  ? (urls.get(row.page.logoPath) ?? null)
                  : null,
              },
              sharedKinds: orderedShares(row.sharedKinds),
              mentalConsent: row.mentalConsentAt !== null,
              message: row.message,
              since: (row.acceptedAt ?? row.createdAt).toISOString(),
            },
          ],
    )
    .sort((a, b) => order[a.status] - order[b.status]);
}

/** Mes plans existants (pour choisir ce que je partage). */
export async function myPlanKinds(userId: string): Promise<ShareableKind[]> {
  const rows = await db.developmentPlan.findMany({
    where: { userId },
    select: { kind: true },
  });
  return orderedShares(rows.map((row) => row.kind));
}

/** Mon suivi ouvert avec cette page (bouton de la page publique), ou null. */
export async function myRelationWith(userId: string, pageId: string) {
  return db.pageClient.findFirst({
    where: { pageId, clientId: userId, status: { in: [...OPEN] } },
    select: { id: true, status: true },
  });
}

/** Demande à devenir client d'une page, en choisissant déjà ce qu'elle verra. */
export async function requestToBecomeClient(
  userId: string,
  pageId: string,
  shares: Shares,
  message: string,
): Promise<Result> {
  const allowed = await canTakePart(userId);
  if (!allowed.ok) return allowed;
  const page = await db.page.findUnique({
    where: { id: pageId },
    select: { ownerId: true, owner: { select: { suspendedUntil: true } } },
  });
  if (!page) return { ok: false, error: "notFound" };
  if (page.ownerId === userId) return { ok: false, error: "self" };
  const blocked = await getBlockedIds(userId);
  if (
    blocked.includes(page.ownerId) ||
    (page.owner.suspendedUntil && page.owner.suspendedUntil > new Date())
  ) {
    return { ok: false, error: "notFound" };
  }
  const [requests, open] = await Promise.all([
    db.pageClient.count({
      where: {
        clientId: userId,
        initiatedBy: "client",
        createdAt: { gte: since24h() },
      },
    }),
    db.pageClient.count({ where: { pageId, status: { in: [...OPEN] } } }),
  ]);
  if (requests >= CLIENT_LIMITS.requestsPerDay) {
    return { ok: false, error: "requestLimit" };
  }
  if (open >= CLIENT_LIMITS.openPerPage) {
    return { ok: false, error: "clientLimit" };
  }
  try {
    await db.pageClient.create({
      data: {
        pageId,
        clientId: userId,
        status: "requested",
        initiatedBy: "client",
        sharedKinds: shares.kinds,
        mentalConsentAt: consentOf(shares),
        message,
      },
    });
  } catch (error) {
    if (isUnique(error)) return { ok: false, error: "already" };
    throw error;
  }
  // La cloche de la page
  await notify({
    userId: page.ownerId,
    pageId,
    kind: "client_request",
    actorId: userId,
    href: "/clients",
    groupKey: `client-request:${userId}`,
  });
  return { ok: true };
}

/** J'accepte l'invitation d'une page, en choisissant ce qu'elle verra. */
export async function acceptInvitation(
  userId: string,
  relationId: string,
  shares: Shares,
): Promise<Result> {
  const allowed = await canTakePart(userId);
  if (!allowed.ok) return allowed;
  const relation = await db.pageClient.findFirst({
    where: { id: relationId, clientId: userId, status: "invited" },
    select: { pageId: true, page: { select: { ownerId: true } } },
  });
  if (!relation) return { ok: false, error: "notFound" };
  await db.pageClient.update({
    where: { id: relationId },
    data: {
      status: "active",
      acceptedAt: new Date(),
      sharedKinds: shares.kinds,
      mentalConsentAt: consentOf(shares),
    },
  });
  await notify({
    userId: relation.page.ownerId,
    pageId: relation.pageId,
    kind: "client_accepted",
    actorId: userId,
    href: `/clients/${userId}`,
    groupKey: `client-accepted:${userId}`,
  });
  return { ok: true };
}

/** Je refuse une invitation (la page n'est pas prévenue). */
export async function declineInvitation(userId: string, relationId: string) {
  const { count } = await db.pageClient.deleteMany({
    where: { id: relationId, clientId: userId, status: "invited" },
  });
  return count > 0;
}

/** Je change ce que la page voit (suivi en cours ou demande). */
export async function updateShares(
  userId: string,
  relationId: string,
  shares: Shares,
): Promise<Result> {
  const relation = await db.pageClient.findFirst({
    where: {
      id: relationId,
      clientId: userId,
      status: { in: ["active", "requested"] },
    },
    select: { mentalConsentAt: true },
  });
  if (!relation) return { ok: false, error: "notFound" };
  await db.pageClient.update({
    where: { id: relationId },
    data: {
      sharedKinds: shares.kinds,
      mentalConsentAt: consentOf(shares, relation.mentalConsentAt),
    },
  });
  return { ok: true };
}

/**
 * Je mets fin au suivi (la page ne voit plus rien tout de suite), ou je retire
 * ma demande.
 */
export async function leavePro(userId: string, relationId: string) {
  const relation = await db.pageClient.findFirst({
    where: {
      id: relationId,
      clientId: userId,
      status: { in: ["active", "requested"] },
    },
    select: { status: true },
  });
  if (!relation) return false;
  if (relation.status === "requested") {
    await db.pageClient.delete({ where: { id: relationId } });
    return true;
  }
  await db.pageClient.update({
    where: { id: relationId },
    data: {
      status: "ended",
      endedAt: new Date(),
      sharedKinds: [],
      mentalConsentAt: null,
    },
  });
  return true;
}
