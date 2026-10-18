import "server-only";
import type { Pillar } from "@/config/pillars";
import type { MessageError } from "@/features/messages/rules";
import {
  DAILY_PACT_PROPOSALS,
  pactNeed,
  pactOutcome,
  pactProgress,
  type PactCell,
  type PactError,
  type PactProposal,
  type PactResponse,
  type PactRule,
} from "@/features/messages/pacts";
import { Prisma } from "@/generated/prisma/client";
import { addDays, fromDbDate, toCalendarDay, toDbDate } from "@/lib/dates";
import { db } from "@/server/db";
import { canWrite, loadMembership } from "./service";

// Pactes : défi à deux dans une conversation. Chaque fonction reçoit l'userId
// de la session ; seul le « fait / pas fait » de l'habitude reliée est partagé.

const DAY_MS = 24 * 60 * 60 * 1000;
type Fail = { ok: false; error: MessageError | PactError };

export type PactCard = {
  id: string;
  title: string;
  days: number;
  rule: PactRule;
  need: number;
  status: "proposed" | "active" | "declined" | "cancelled" | "ended";
  outcome: "success" | "failed" | null;
  startsOn: string | null;
  endsOn: string | null;
  proposedByMe: boolean;
  /** Résultats, une fois le pacte terminé. */
  together: number;
  mine: number;
  theirs: number;
};

export type PactBanner = PactCard & {
  dayIndex: number;
  cells: PactCell[];
  streak: number;
  meToday: boolean;
  themToday: boolean;
  /** Heure à laquelle l'autre a fait sa part aujourd'hui. */
  themTodayAt: string | null;
  /** L'habitude reliée a été supprimée : ses jours ne comptent plus. */
  myHabitMissing: boolean;
};

const pactSelect = {
  id: true,
  title: true,
  pillar: true,
  days: true,
  rule: true,
  status: true,
  outcome: true,
  startsOn: true,
  endsOn: true,
  proposedById: true,
  members: { select: { userId: true, habitId: true } },
} as const;

type PactRow = Prisma.PactGetPayload<{ select: typeof pactSelect }>;

async function timeZoneOf(userId: string) {
  const settings = await db.userSettings.findUnique({
    where: { userId },
    select: { timeZone: true },
  });
  return settings?.timeZone ?? "America/Toronto";
}

/** Jours faits d'une habitude entre deux jours (avec l'heure de chaque coche). */
async function doneDays(habitId: string | null, from: string, to: string) {
  if (!habitId) return new Map<string, Date>();
  const rows = await db.habitCompletion.findMany({
    where: { habitId, day: { gte: toDbDate(from), lte: toDbDate(to) } },
    select: { day: true, createdAt: true },
  });
  return new Map(rows.map((row) => [fromDbDate(row.day), row.createdAt]));
}

/** Avancement d'un pacte commencé, vu par `viewerId`, jusqu'à `today`. */
async function progressOf(pact: PactRow, viewerId: string, today: string) {
  if (!pact.startsOn || !pact.endsOn) return null;
  const startsOn = fromDbDate(pact.startsOn);
  const endsOn = fromDbDate(pact.endsOn);
  const me = pact.members.find((m) => m.userId === viewerId);
  const them = pact.members.find((m) => m.userId !== viewerId);
  const [mine, theirs] = await Promise.all([
    doneDays(me?.habitId ?? null, startsOn, endsOn),
    doneDays(them?.habitId ?? null, startsOn, endsOn),
  ]);
  return {
    progress: pactProgress({
      startsOn,
      days: pact.days,
      today,
      mine: new Set(mine.keys()),
      theirs: new Set(theirs.keys()),
    }),
    theirs,
    myHabitMissing: !me?.habitId,
  };
}

function toCard(
  pact: PactRow,
  viewerId: string,
  results = { together: 0, mine: 0, theirs: 0 },
): PactCard {
  return {
    id: pact.id,
    title: pact.title,
    days: pact.days,
    rule: pact.rule,
    need: pactNeed(pact.days, pact.rule),
    status: pact.status,
    outcome: pact.outcome,
    startsOn: pact.startsOn ? fromDbDate(pact.startsOn) : null,
    endsOn: pact.endsOn ? fromDbDate(pact.endsOn) : null,
    proposedByMe: pact.proposedById === viewerId,
    ...results,
  };
}

/**
 * Termine les pactes arrivés au bout (pas de tâche planifiée : vérifié à
 * l'ouverture de la conversation). La fin ajoute une étape dans la conversation.
 */
export async function settlePacts(conversationId: string, viewerId: string) {
  const today = toCalendarDay(new Date(), await timeZoneOf(viewerId));
  const due = await db.pact.findMany({
    where: {
      conversationId,
      status: "active",
      endsOn: { lt: toDbDate(today) },
    },
    select: pactSelect,
  });
  for (const pact of due) {
    const data = await progressOf(pact, viewerId, today);
    if (!data) continue;
    const outcome = pactOutcome({
      need: pactNeed(pact.days, pact.rule),
      mineCount: data.progress.mineCount,
      theirsCount: data.progress.theirsCount,
    });
    await db.$transaction(async (tx) => {
      // Une seule fin, même si les deux ouvrent la conversation en même temps
      const { count } = await tx.pact.updateMany({
        where: { id: pact.id, status: "active" },
        data: { status: "ended", outcome },
      });
      if (count === 0) return;
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

/** Cartes des pactes cités dans une page de messages (état et résultats). */
export async function pactCardsFor(viewerId: string, pactIds: string[]) {
  if (pactIds.length === 0) return new Map<string, PactCard>();
  const today = toCalendarDay(new Date(), await timeZoneOf(viewerId));
  const pacts = await db.pact.findMany({
    where: { id: { in: pactIds } },
    select: pactSelect,
  });
  const cards = await Promise.all(
    pacts.map(async (pact) => {
      if (pact.status !== "ended") return toCard(pact, viewerId);
      const data = await progressOf(pact, viewerId, today);
      return toCard(pact, viewerId, {
        together: data?.progress.together ?? 0,
        mine: data?.progress.mineCount ?? 0,
        theirs: data?.progress.theirsCount ?? 0,
      });
    }),
  );
  return new Map(cards.map((card) => [card.id, card]));
}

/** Le pacte ouvert de la conversation (proposé ou en cours), et le nombre de pactes déjà faits. */
export async function getOpenPact(
  viewerId: string,
  conversationId: string,
): Promise<{ pact: PactBanner | null; count: number }> {
  const [pact, count] = await Promise.all([
    db.pact.findFirst({
      where: { conversationId, status: { in: ["proposed", "active"] } },
      select: pactSelect,
    }),
    db.pact.count({ where: { conversationId } }),
  ]);
  if (!pact) return { pact: null, count };
  const timeZone = await timeZoneOf(viewerId);
  const today = toCalendarDay(new Date(), timeZone);
  const data = await progressOf(pact, viewerId, today);
  const base = toCard(pact, viewerId, {
    together: data?.progress.together ?? 0,
    mine: data?.progress.mineCount ?? 0,
    theirs: data?.progress.theirsCount ?? 0,
  });
  return {
    count,
    pact: {
      ...base,
      dayIndex: data?.progress.dayIndex ?? 0,
      cells: data?.progress.cells ?? [],
      streak: data?.progress.streak ?? 0,
      meToday: data?.progress.meToday ?? false,
      themToday: data?.progress.themToday ?? false,
      themTodayAt: data?.theirs.get(today)?.toISOString() ?? null,
      myHabitMissing: data?.myHabitMissing ?? false,
    },
  };
}

/** Habitudes actives qu'on peut relier à un pacte. */
export async function listPactHabits(userId: string) {
  return db.habit.findMany({
    where: { userId, archivedAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, title: true, pillar: true },
  });
}

/** Propose un pacte dans une conversation acceptée des deux côtés. */
export async function proposePact(
  viewerId: string,
  conversationId: string,
  input: PactProposal,
): Promise<{ ok: true } | Fail> {
  const allowed = await canWrite(viewerId);
  if (!allowed.ok) return allowed;
  const membership = await loadMembership(viewerId, conversationId);
  if (!membership) return { ok: false, error: "notFound" };
  if (
    membership.viewer.status !== "accepted" ||
    membership.other.status !== "accepted"
  ) {
    return { ok: false, error: "requestPending" };
  }
  const habit = await db.habit.findFirst({
    where: { id: input.habitId, userId: viewerId, archivedAt: null },
    select: { id: true, pillar: true },
  });
  if (!habit) return { ok: false, error: "habitRequired" };
  const [open, recent] = await Promise.all([
    db.pact.count({
      where: { conversationId, status: { in: ["proposed", "active"] } },
    }),
    db.pact.count({
      where: {
        proposedById: viewerId,
        createdAt: { gte: new Date(Date.now() - DAY_MS) },
      },
    }),
  ]);
  if (open > 0) return { ok: false, error: "pactOpen" };
  if (recent >= DAILY_PACT_PROPOSALS) return { ok: false, error: "pactLimit" };

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
              { userId: membership.other.userId },
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
      await tx.conversationMember.update({
        where: { conversationId_userId: { conversationId, userId: viewerId } },
        data: { lastReadAt: now },
      });
    });
  } catch (error) {
    // Un autre pacte vient d'être proposé dans la conversation (index unique)
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { ok: false, error: "pactOpen" };
    }
    throw error;
  }
  return { ok: true };
}

/** Accepte (en reliant une habitude, ou en la créant) ou refuse un pacte proposé. */
export async function respondToPact(
  viewerId: string,
  pactId: string,
  response: PactResponse,
): Promise<{ ok: true } | Fail> {
  const allowed = await canWrite(viewerId);
  if (!allowed.ok) return allowed;
  const pact = await db.pact.findFirst({
    where: {
      id: pactId,
      status: "proposed",
      proposedById: { not: viewerId },
      members: { some: { userId: viewerId } },
    },
    select: {
      id: true,
      conversationId: true,
      title: true,
      pillar: true,
      days: true,
    },
  });
  if (!pact) return { ok: false, error: "notFound" };
  if (!(await loadMembership(viewerId, pact.conversationId))) {
    return { ok: false, error: "notFound" };
  }

  if (!response.accept) {
    await db.pact.updateMany({
      where: { id: pact.id, status: "proposed" },
      data: { status: "declined" },
    });
    return { ok: true };
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
  // Le pacte commence demain, dans le fuseau de la personne qui accepte
  const startsOn = addDays(
    toCalendarDay(new Date(), await timeZoneOf(viewerId)),
    1,
  );
  const endsOn = addDays(startsOn, pact.days - 1);
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
    const { count } = await tx.pact.updateMany({
      where: { id: pact.id, status: "proposed" },
      data: {
        status: "active",
        startsOn: toDbDate(startsOn),
        endsOn: toDbDate(endsOn),
      },
    });
    if (count === 0) throw new Error("Pacte déjà traité");
    await tx.pactMember.update({
      where: { pactId_userId: { pactId: pact.id, userId: viewerId } },
      data: { habitId: linked, joinedAt: new Date() },
    });
  });
  return { ok: true };
}

/**
 * Quitte un pacte en cours, ou retire sa proposition. L'autre voit seulement
 * « Le pacte est terminé ».
 */
export async function cancelPact(viewerId: string, pactId: string) {
  const pact = await db.pact.findFirst({
    where: {
      id: pactId,
      members: { some: { userId: viewerId } },
      OR: [
        { status: "active" },
        { status: "proposed", proposedById: viewerId },
      ],
    },
    select: { id: true, conversationId: true },
  });
  if (!pact) return false;
  const now = new Date();
  await db.$transaction(async (tx) => {
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

export type PactTag = {
  partnerName: string;
  dayIndex: number;
  days: number;
  partnerDone: boolean;
};

/**
 * Pactes en cours des habitudes du jour (étiquette dans « Ma journée ») :
 * jour du pacte et si l'autre a déjà fait sa part aujourd'hui.
 */
export async function pactTagsForHabits(
  userId: string,
  habitIds: string[],
  today: string,
): Promise<Record<string, PactTag>> {
  if (habitIds.length === 0) return {};
  const members = await db.pactMember.findMany({
    where: {
      userId,
      habitId: { in: habitIds },
      pact: { status: "active", startsOn: { lte: toDbDate(today) } },
    },
    select: {
      habitId: true,
      pact: {
        select: {
          days: true,
          startsOn: true,
          members: {
            where: { userId: { not: userId } },
            select: {
              habitId: true,
              userId: true,
              profile: {
                select: {
                  displayName: true,
                  username: true,
                  settings: { select: { timeZone: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  const tags: Record<string, PactTag> = {};
  for (const member of members) {
    const partner = member.pact.members[0];
    if (!member.habitId || !member.pact.startsOn || !partner) continue;
    // « Aujourd'hui » de l'autre, dans son propre fuseau
    const partnerToday = toCalendarDay(
      new Date(),
      partner.profile.settings?.timeZone ?? "America/Toronto",
    );
    const partnerDone = partner.habitId
      ? (await db.habitCompletion.count({
          where: { habitId: partner.habitId, day: toDbDate(partnerToday) },
        })) > 0
      : false;
    const startsOn = fromDbDate(member.pact.startsOn);
    tags[member.habitId] = {
      partnerName:
        partner.profile.displayName ?? partner.profile.username ?? "",
      dayIndex: Math.min(
        member.pact.days,
        Math.round(
          (toDbDate(today).getTime() - toDbDate(startsOn).getTime()) / DAY_MS,
        ) + 1,
      ),
      days: member.pact.days,
      partnerDone,
    };
  }
  return tags;
}

/** Pactes réussis récents, que l'on peut partager dans le Centre. */
export async function listSuccessfulPacts(userId: string) {
  return db.pact.findMany({
    where: {
      status: "ended",
      outcome: "success",
      members: { some: { userId } },
      updatedAt: { gte: new Date(Date.now() - 60 * DAY_MS) },
    },
    orderBy: { updatedAt: "desc" },
    take: 3,
    select: { id: true },
  });
}

/** Résultat figé d'un pacte réussi (partage dans le Centre) ; null sinon. */
export async function frozenPact(userId: string, pactId: string) {
  const pact = await db.pact.findFirst({
    where: {
      id: pactId,
      status: "ended",
      outcome: "success",
      members: { some: { userId } },
    },
    select: pactSelect,
  });
  if (!pact) return null;
  const today = toCalendarDay(new Date(), await timeZoneOf(userId));
  const data = await progressOf(pact, userId, today);
  return {
    type: "pact" as const,
    title: pact.title,
    days: pact.days,
    together: data?.progress.together ?? 0,
    pillar: pact.pillar,
  };
}
