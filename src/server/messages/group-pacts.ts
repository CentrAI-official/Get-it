import "server-only";
import type { Pillar } from "@/config/pillars";
import type { MessageError } from "@/features/messages/rules";
import {
  DAILY_PACT_PROPOSALS,
  groupPactOutcome,
  groupPactProgress,
  PACT_GROUP_MIN,
  pactNeed,
  type PactError,
  type PactProposal,
  type PactResponse,
  type PactRule,
} from "@/features/messages/pacts";
import { Prisma } from "@/generated/prisma/client";
import { addDays, fromDbDate, toCalendarDay, toDbDate } from "@/lib/dates";
import { getBlockedIds } from "@/server/community/members";
import { db } from "@/server/db";
import { avatarUrls } from "@/server/profile/avatar";
import { notify } from "@/server/notifications/service";
import { canWrite } from "./service";

// Pactes de groupe : un défi proposé dans la discussion d'un groupe privé. Les
// autres membres le rejoignent (chacun relie sa propre habitude) jusqu'au premier
// jour ; il commence le lendemain de la première acceptation, avec ceux qui ont
// accepté. Seul le « fait / pas fait » de chaque habitude est partagé.

const DAY_MS = 24 * 60 * 60 * 1000;
type Fail = { ok: false; error: MessageError | PactError };

export type GroupPactPerson = {
  id: string;
  name: string;
  avatarUrl: string | null;
  /** Jours faits depuis le début du pacte. */
  count: number;
  today: boolean;
};

export type GroupPactState = {
  id: string;
  title: string;
  days: number;
  rule: PactRule;
  need: number;
  status: "proposed" | "active";
  startsOn: string | null;
  endsOn: string | null;
  /** Jour du pacte (1 au premier jour), 0 avant le début. */
  dayIndex: number;
  proposedByMe: boolean;
  proposerName: string;
  /** Ma place : participant, invité (pas encore répondu), ou rien. */
  me: "joined" | "invited" | null;
  /** Je peux encore le rejoindre (invité, avant le premier jour). */
  canJoin: boolean;
  participants: GroupPactPerson[];
  /** L'habitude que j'ai reliée a été supprimée : mes jours ne comptent plus. */
  myHabitMissing: boolean;
};

async function timeZoneOf(userId: string) {
  const settings = await db.userSettings.findUnique({
    where: { userId },
    select: { timeZone: true },
  });
  return settings?.timeZone ?? "America/Toronto";
}

/** Conversation d'un groupe privé dont `viewerId` est membre actif. */
async function groupChat(viewerId: string, conversationId: string) {
  return db.conversation.findFirst({
    where: {
      id: conversationId,
      groupId: { not: null },
      members: { some: { userId: viewerId } },
      group: { members: { some: { userId: viewerId, status: "active" } } },
    },
    select: {
      id: true,
      group: {
        select: {
          members: { where: { status: "active" }, select: { userId: true } },
        },
      },
    },
  });
}

/** Vrai si la conversation est la discussion d'un groupe. */
export async function isGroupConversation(conversationId: string) {
  const conversation = await db.conversation.findUnique({
    where: { id: conversationId },
    select: { groupId: true },
  });
  return Boolean(conversation?.groupId);
}

/** Vrai si le pacte appartient à la discussion d'un groupe. */
export async function isGroupPact(pactId: string) {
  const pact = await db.pact.findUnique({
    where: { id: pactId },
    select: { conversation: { select: { groupId: true } } },
  });
  return Boolean(pact?.conversation.groupId);
}

const groupPactSelect = {
  id: true,
  title: true,
  days: true,
  rule: true,
  status: true,
  startsOn: true,
  endsOn: true,
  proposedById: true,
  members: {
    select: {
      userId: true,
      habitId: true,
      joinedAt: true,
      profile: {
        select: { displayName: true, username: true, avatarPath: true },
      },
    },
  },
} as const;

type GroupPactRow = Prisma.PactGetPayload<{ select: typeof groupPactSelect }>;

/** Jours faits de chaque habitude reliée, entre deux jours. */
async function doneDaysByHabit(habitIds: string[], from: string, to: string) {
  const byHabit = new Map<string, Set<string>>();
  if (habitIds.length === 0) return byHabit;
  const rows = await db.habitCompletion.findMany({
    where: {
      habitId: { in: habitIds },
      day: { gte: toDbDate(from), lte: toDbDate(to) },
    },
    select: { habitId: true, day: true },
  });
  for (const row of rows) {
    const days = byHabit.get(row.habitId) ?? new Set<string>();
    days.add(fromDbDate(row.day));
    byHabit.set(row.habitId, days);
  }
  return byHabit;
}

/** Participants (ceux qui ont accepté) et leurs jours faits jusqu'à `today`. */
async function participantsOf(pact: GroupPactRow, today: string) {
  const joined = pact.members.filter((member) => member.joinedAt);
  if (!pact.startsOn) {
    return {
      dayIndex: 0,
      members: joined.map((member) => ({
        id: member.userId,
        count: 0,
        today: false,
      })),
    };
  }
  const startsOn = fromDbDate(pact.startsOn);
  const done = await doneDaysByHabit(
    joined.flatMap((member) => (member.habitId ? [member.habitId] : [])),
    startsOn,
    addDays(startsOn, pact.days - 1),
  );
  return groupPactProgress({
    startsOn,
    days: pact.days,
    today,
    members: joined.map((member) => ({
      id: member.userId,
      done: (member.habitId && done.get(member.habitId)) || new Set<string>(),
    })),
  });
}

/** Le pacte ouvert (proposé ou en cours) de la discussion d'un groupe. */
export async function getGroupPact(
  viewerId: string,
  conversationId: string,
): Promise<GroupPactState | null> {
  const pact = await db.pact.findFirst({
    where: { conversationId, status: { in: ["proposed", "active"] } },
    select: groupPactSelect,
  });
  if (!pact) return null;
  const [timeZone, blocked] = await Promise.all([
    timeZoneOf(viewerId),
    getBlockedIds(viewerId),
  ]);
  const today = toCalendarDay(new Date(), timeZone);
  const progress = await participantsOf(pact, today);
  const byId = new Map(pact.members.map((member) => [member.userId, member]));
  const avatars = await avatarUrls(
    pact.members.map((member) => member.profile.avatarPath),
  );
  const nameOf = (userId: string) => {
    const profile = byId.get(userId)?.profile;
    return profile?.displayName ?? profile?.username ?? "";
  };
  const mine = byId.get(viewerId);
  const startsOn = pact.startsOn ? fromDbDate(pact.startsOn) : null;
  const beforeStart = startsOn === null || today < startsOn;
  return {
    id: pact.id,
    title: pact.title,
    days: pact.days,
    rule: pact.rule,
    need: pactNeed(pact.days, pact.rule),
    status: pact.status === "active" ? "active" : "proposed",
    startsOn,
    endsOn: pact.endsOn ? fromDbDate(pact.endsOn) : null,
    dayIndex: progress.dayIndex,
    proposedByMe: pact.proposedById === viewerId,
    proposerName: nameOf(pact.proposedById),
    me: mine ? (mine.joinedAt ? "joined" : "invited") : null,
    canJoin: Boolean(mine && !mine.joinedAt && beforeStart),
    // Les personnes bloquées n'apparaissent pas (leurs jours comptent quand même)
    participants: progress.members
      .filter((member) => !blocked.includes(member.id))
      .map((member) => {
        const avatarPath = byId.get(member.id)?.profile.avatarPath;
        return {
          ...member,
          name: nameOf(member.id),
          avatarUrl: avatarPath ? (avatars.get(avatarPath) ?? null) : null,
        };
      }),
    myHabitMissing: Boolean(mine?.joinedAt && !mine.habitId),
  };
}

/** Propose un pacte à tout le groupe ; celui qui propose y participe avec son habitude. */
export async function proposeGroupPact(
  viewerId: string,
  conversationId: string,
  input: PactProposal,
): Promise<{ ok: true } | Fail> {
  const allowed = await canWrite(viewerId);
  if (!allowed.ok) return allowed;
  const chat = await groupChat(viewerId, conversationId);
  if (!chat?.group) return { ok: false, error: "notFound" };
  const habit = await db.habit.findFirst({
    where: { id: input.habitId, userId: viewerId, archivedAt: null },
    select: { id: true, pillar: true },
  });
  if (!habit) return { ok: false, error: "habitRequired" };
  const [open, recent, blocked] = await Promise.all([
    db.pact.count({
      where: { conversationId, status: { in: ["proposed", "active"] } },
    }),
    db.pact.count({
      where: {
        proposedById: viewerId,
        createdAt: { gte: new Date(Date.now() - DAY_MS) },
      },
    }),
    getBlockedIds(viewerId),
  ]);
  if (open > 0) return { ok: false, error: "pactOpen" };
  if (recent >= DAILY_PACT_PROPOSALS) return { ok: false, error: "pactLimit" };
  // Invités : les autres membres actifs, sauf les personnes bloquées
  const invited = chat.group.members
    .map((member) => member.userId)
    .filter((id) => id !== viewerId && !blocked.includes(id));
  if (invited.length === 0) return { ok: false, error: "notFound" };

  const now = new Date();
  try {
    await db.$transaction(async (tx) => {
      const pact = await tx.pact.create({
        data: {
          conversationId,
          proposedById: viewerId,
          title: input.title,
          pillar: habit.pillar,
          days: input.days,
          rule: input.rule,
          members: {
            create: [
              { userId: viewerId, habitId: habit.id, joinedAt: now },
              ...invited.map((userId) => ({ userId })),
            ],
          },
        },
        select: { id: true },
      });
      await tx.message.create({
        data: {
          conversationId,
          senderId: viewerId,
          kind: "pact",
          body: "proposed",
          pactId: pact.id,
          createdAt: now,
        },
      });
      await tx.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: now },
      });
    });
  } catch (error) {
    // Un autre pacte vient d'être proposé dans la discussion (index unique)
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { ok: false, error: "pactOpen" };
    }
    throw error;
  }
  await Promise.all(
    invited.map((userId) =>
      notify({
        userId,
        kind: "pact",
        actorId: viewerId,
        href: `/messages/${conversationId}`,
        subject: input.title,
      }),
    ),
  );
  return { ok: true };
}

/**
 * Rejoindre (en reliant une habitude, ou en la créant) ou refuser un pacte de
 * groupe. La première acceptation le fait commencer le lendemain.
 */
export async function respondToGroupPact(
  viewerId: string,
  pactId: string,
  response: PactResponse,
): Promise<{ ok: true } | Fail> {
  const allowed = await canWrite(viewerId);
  if (!allowed.ok) return allowed;
  const pact = await db.pact.findFirst({
    where: {
      id: pactId,
      status: { in: ["proposed", "active"] },
      conversation: { groupId: { not: null } },
      members: { some: { userId: viewerId, joinedAt: null } },
    },
    select: {
      id: true,
      conversationId: true,
      title: true,
      pillar: true,
      days: true,
      status: true,
      startsOn: true,
    },
  });
  if (!pact || !(await groupChat(viewerId, pact.conversationId))) {
    return { ok: false, error: "notFound" };
  }
  if (!response.accept) {
    // Refuser ne prévient personne : l'invitation disparaît
    await db.pactMember.deleteMany({
      where: { pactId: pact.id, userId: viewerId, joinedAt: null },
    });
    return { ok: true };
  }
  const today = toCalendarDay(new Date(), await timeZoneOf(viewerId));
  if (pact.startsOn && fromDbDate(pact.startsOn) <= today) {
    // Le pacte a déjà commencé : trop tard pour le rejoindre
    return { ok: false, error: "notFound" };
  }
  let habitId: string | null = null;
  if (response.habit.kind === "existing") {
    const habit = await db.habit.findFirst({
      where: { id: response.habit.id, userId: viewerId, archivedAt: null },
      select: { id: true },
    });
    if (!habit) return { ok: false, error: "habitRequired" };
    habitId = habit.id;
  }
  const startsOn = addDays(today, 1);
  await db.$transaction(async (tx) => {
    const linked =
      habitId ??
      (
        await tx.habit.create({
          data: {
            userId: viewerId,
            title: pact.title,
            pillar: pact.pillar as Pillar,
            weekdays: [1, 2, 3, 4, 5, 6, 7],
          },
          select: { id: true },
        })
      ).id;
    await tx.pactMember.update({
      where: { pactId_userId: { pactId: pact.id, userId: viewerId } },
      data: { habitId: linked, joinedAt: new Date() },
    });
    // Première acceptation : le pacte commence demain
    await tx.pact.updateMany({
      where: { id: pact.id, status: "proposed" },
      data: {
        status: "active",
        startsOn: toDbDate(startsOn),
        endsOn: toDbDate(addDays(startsOn, pact.days - 1)),
      },
    });
  });
  return { ok: true };
}

/**
 * Quitter un pacte de groupe (ou retirer sa proposition). S'il reste moins de
 * deux participants, le pacte est terminé pour tout le monde.
 */
export async function leaveGroupPact(viewerId: string, pactId: string) {
  const pact = await db.pact.findFirst({
    where: {
      id: pactId,
      status: { in: ["proposed", "active"] },
      conversation: { groupId: { not: null } },
      members: { some: { userId: viewerId, joinedAt: { not: null } } },
    },
    select: {
      id: true,
      conversationId: true,
      status: true,
      proposedById: true,
      members: { select: { userId: true, joinedAt: true } },
    },
  });
  if (!pact) return false;
  const joined = pact.members.filter(
    (member) => member.joinedAt && member.userId !== viewerId,
  );
  // Proposition retirée, ou plus assez de participants : fin pour tout le monde
  const ends =
    (pact.status === "proposed" && pact.proposedById === viewerId) ||
    (pact.status === "active" && joined.length < PACT_GROUP_MIN);
  const now = new Date();
  await db.$transaction(async (tx) => {
    if (!ends) {
      await tx.pactMember.deleteMany({
        where: { pactId: pact.id, userId: viewerId },
      });
      return;
    }
    const { count } = await tx.pact.updateMany({
      where: { id: pact.id, status: { in: ["proposed", "active"] } },
      data: { status: "cancelled", endedById: viewerId },
    });
    if (count === 0) return;
    await tx.message.create({
      data: {
        conversationId: pact.conversationId,
        senderId: viewerId,
        kind: "pact",
        body: "cancelled",
        pactId: pact.id,
        createdAt: now,
      },
    });
    await tx.conversation.update({
      where: { id: pact.conversationId },
      data: { lastMessageAt: now },
    });
  });
  return true;
}

/**
 * Termine les pactes de groupe arrivés au bout (vérifié à l'ouverture de la
 * discussion, sans tâche planifiée) : réussi si 80 % des participants ont réussi.
 */
export async function settleGroupPacts(
  conversationId: string,
  viewerId: string,
) {
  const today = toCalendarDay(new Date(), await timeZoneOf(viewerId));
  const due = await db.pact.findMany({
    where: {
      conversationId,
      status: "active",
      endsOn: { lt: toDbDate(today) },
    },
    select: groupPactSelect,
  });
  for (const pact of due) {
    const progress = await participantsOf(pact, today);
    const outcome = groupPactOutcome(
      pactNeed(pact.days, pact.rule),
      progress.members.map((member) => member.count),
    );
    await db.$transaction(async (tx) => {
      // Une seule fin, même si plusieurs membres ouvrent la discussion en même temps
      const { count } = await tx.pact.updateMany({
        where: { id: pact.id, status: "active" },
        data: { status: "ended", outcome },
      });
      if (count === 0) return;
      // Les invitations restées sans réponse disparaissent
      await tx.pactMember.deleteMany({
        where: { pactId: pact.id, joinedAt: null },
      });
      const now = new Date();
      await tx.message.create({
        data: {
          conversationId,
          senderId: pact.proposedById,
          kind: "pact",
          body: "ended",
          pactId: pact.id,
          createdAt: now,
        },
      });
      await tx.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: now },
      });
    });
  }
}
