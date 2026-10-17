import "server-only";
import { PILLARS, type Pillar } from "@/config/pillars";
import { DAILY_TASK_XP_LIMIT, levelFromXp } from "@/features/xp/rules";
import type { Prisma } from "@/generated/prisma/client";
import { fromDbDate, toDbDate } from "@/lib/dates";
import { db } from "@/server/db";

// Chaque fonction reçoit l'userId de la session et filtre dessus.
// L'XP s'écrit dans la même transaction que l'action qui la rapporte (voir les
// services des habitudes, tâches, objectifs et check-ins).

export type Tx = Prisma.TransactionClient;

export type XpTotals = {
  total: number;
  pillars: Record<Pillar, number>;
};

/** XP totale et XP de chaque pilier. */
export async function getXpTotals(userId: string): Promise<XpTotals> {
  const rows = await db.xpEvent.groupBy({
    by: ["pillar"],
    where: { userId },
    _sum: { amount: true },
  });
  const pillars = Object.fromEntries(
    PILLARS.map((pillar) => [pillar, 0]),
  ) as Record<Pillar, number>;
  let total = 0;
  for (const row of rows) {
    const amount = row._sum.amount ?? 0;
    total += amount;
    if (row.pillar) pillars[row.pillar] += amount;
  }
  return { total, pillars };
}

/** XP gagnée chaque jour entre `from` et `to` inclus (« AAAA-MM-JJ » → XP). */
/** Niveau de plusieurs membres (fil du Centre, Messagerie), selon leur XP totale. */
export async function getLevels(userIds: string[]) {
  if (userIds.length === 0) return new Map<string, number>();
  const rows = await db.xpEvent.groupBy({
    by: ["userId"],
    where: { userId: { in: userIds } },
    _sum: { amount: true },
  });
  return new Map(
    rows.map((row) => [row.userId, levelFromXp(row._sum.amount ?? 0).level]),
  );
}

export async function getXpByDay(userId: string, from: string, to: string) {
  const rows = await db.xpEvent.groupBy({
    by: ["day"],
    where: { userId, day: { gte: toDbDate(from), lte: toDbDate(to) } },
    _sum: { amount: true },
  });
  return new Map(
    rows.map((row) => [fromDbDate(row.day), row._sum.amount ?? 0]),
  );
}

/** Tâches qui peuvent encore rapporter de l'XP aujourd'hui (plafond quotidien). */
export async function getTaskXpLeft(userId: string, day: string) {
  const used = await db.xpEvent.count({
    where: { userId, source: "task", day: toDbDate(day) },
  });
  return Math.max(0, DAILY_TASK_XP_LIMIT - used);
}

/** XP déjà gagnée par ces tâches (tâche → XP). */
export async function getTaskXp(userId: string, taskIds: string[]) {
  if (taskIds.length === 0) return new Map<string, number>();
  const rows = await db.xpEvent.findMany({
    where: { userId, taskId: { in: taskIds } },
    select: { taskId: true, amount: true },
  });
  return new Map(rows.map((row) => [row.taskId ?? "", row.amount]));
}

type Award = {
  userId: string;
  amount: number;
  pillar: Pillar | null;
  /** Jour où l'XP compte, « AAAA-MM-JJ ». */
  day: string;
};

/** XP d'une habitude cochée (une seule fois par jour coché). */
export async function awardHabitDay(
  tx: Tx,
  completionId: string,
  award: Award,
) {
  await tx.xpEvent.upsert({
    where: { habitCompletionId: completionId },
    update: {},
    create: {
      ...toEventData(award),
      source: "habit_day",
      habitCompletionId: completionId,
    },
  });
}

/**
 * XP d'une tâche terminée, dans la limite quotidienne. Vrai si l'XP est
 * accordée.
 */
export async function awardTask(tx: Tx, taskId: string, award: Award) {
  const used = await tx.xpEvent.count({
    where: { userId: award.userId, source: "task", day: toDbDate(award.day) },
  });
  if (used >= DAILY_TASK_XP_LIMIT) return false;
  await tx.xpEvent.upsert({
    where: { taskId },
    update: {},
    create: { ...toEventData(award), source: "task", taskId },
  });
  return true;
}

export async function awardMilestone(
  tx: Tx,
  milestoneId: string,
  award: Award,
) {
  await tx.xpEvent.upsert({
    where: { milestoneId },
    update: {},
    create: { ...toEventData(award), source: "milestone", milestoneId },
  });
}

export async function awardGoal(tx: Tx, goalId: string, award: Award) {
  await tx.xpEvent.upsert({
    where: { goalId },
    update: {},
    create: { ...toEventData(award), source: "goal", goalId },
  });
}

export async function awardCheckIn(tx: Tx, checkInId: string, award: Award) {
  await tx.xpEvent.upsert({
    where: { checkInId },
    update: {},
    create: { ...toEventData(award), source: "check_in", checkInId },
  });
}

/** Action annulée (tâche décochée, objectif repris…) : son XP est retirée. */
export async function revokeXp(
  tx: Tx,
  userId: string,
  source: { taskId: string } | { milestoneId: string } | { goalId: string },
) {
  await tx.xpEvent.deleteMany({ where: { userId, ...source } });
}

function toEventData(award: Award) {
  return {
    userId: award.userId,
    amount: award.amount,
    pillar: award.pillar,
    day: toDbDate(award.day),
  };
}
