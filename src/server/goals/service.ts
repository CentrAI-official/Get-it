import "server-only";
import type { Pillar } from "@/config/pillars";
import {
  ACTIVE_GOALS_PER_PILLAR,
  type GoalStatus,
} from "@/features/goals/schemas";
import { XP_REWARDS } from "@/features/xp/rules";
import { fromDbDate, toCalendarDay, toDbDate } from "@/lib/dates";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { avatarUrl, avatarUrls } from "@/server/profile/avatar";
import { getUserTimeZone } from "@/server/profile/service";
import { removeFiles } from "@/server/storage/service";
import { awardGoal, awardMilestone, revokeXp } from "@/server/xp/service";

// Chaque fonction reçoit l'userId de la session et filtre dessus : un utilisateur
// ne lit et ne modifie que ses propres objectifs et jalons.

export type GoalSummary = {
  id: string;
  title: string;
  pillar: Pillar;
  status: GoalStatus;
  /** Jour visé, « AAAA-MM-JJ ». */
  targetDate: string | null;
  milestonesDone: number;
  milestonesTotal: number;
  /** Photo choisie pour l'objectif (lien temporaire), sinon l'icône du pilier. */
  photoUrl: string | null;
};

const summarySelect = {
  id: true,
  title: true,
  pillar: true,
  status: true,
  targetDate: true,
  photoPath: true,
  milestones: { select: { completedAt: true } },
} as const;

type SummaryRow = {
  id: string;
  title: string;
  pillar: Pillar;
  status: GoalStatus;
  targetDate: Date | null;
  photoPath: string | null;
  milestones: { completedAt: Date | null }[];
};

function toSummary(goal: SummaryRow, photos: Map<string, string>): GoalSummary {
  return {
    id: goal.id,
    title: goal.title,
    pillar: goal.pillar,
    status: goal.status,
    targetDate: goal.targetDate ? fromDbDate(goal.targetDate) : null,
    milestonesDone: goal.milestones.filter((m) => m.completedAt).length,
    milestonesTotal: goal.milestones.length,
    photoUrl: goal.photoPath ? (photos.get(goal.photoPath) ?? null) : null,
  };
}

/** Résumés d'objectifs avec les liens de leurs photos. */
async function toSummaries(goals: SummaryRow[]) {
  const photos = await avatarUrls(goals.map((goal) => goal.photoPath));
  return goals.map((goal) => toSummary(goal, photos));
}

/** Tous les objectifs, du plus ancien au plus récent. */
export async function listGoals(userId: string): Promise<GoalSummary[]> {
  const goals = await db.goal.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: summarySelect,
  });
  return toSummaries(goals);
}

/** Objectifs en cours, du plus ancien au plus récent. */
export async function listActiveGoals(userId: string): Promise<GoalSummary[]> {
  const goals = await db.goal.findMany({
    where: { userId, status: "active" },
    orderBy: { createdAt: "asc" },
    select: summarySelect,
  });
  return toSummaries(goals);
}

export type DayGoal = {
  id: string;
  title: string;
  pillar: Pillar;
  milestonesDone: number;
  milestonesTotal: number;
  /** Premier jalon pas encore atteint, dans l'ordre du plan. */
  nextMilestone: { id: string; title: string } | null;
  photoUrl: string | null;
};

/** Objectifs en cours et leur prochain jalon (popup « Ma journée »). */
export async function listActiveGoalsWithNextMilestone(
  userId: string,
): Promise<DayGoal[]> {
  const goals = await db.goal.findMany({
    where: { userId, status: "active" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      title: true,
      pillar: true,
      photoPath: true,
      milestones: {
        orderBy: { position: "asc" },
        select: { id: true, title: true, completedAt: true },
      },
    },
  });
  const photos = await avatarUrls(goals.map((goal) => goal.photoPath));
  return goals.map((goal) => {
    const next = goal.milestones.find((milestone) => !milestone.completedAt);
    return {
      id: goal.id,
      title: goal.title,
      pillar: goal.pillar,
      milestonesDone: goal.milestones.filter((m) => m.completedAt).length,
      milestonesTotal: goal.milestones.length,
      nextMilestone: next ? { id: next.id, title: next.title } : null,
      photoUrl: goal.photoPath ? (photos.get(goal.photoPath) ?? null) : null,
    };
  });
}

/** Objectifs en cours avec leurs jalons et leurs tâches ouvertes (contexte de Get iT AI). */
export async function listActiveGoalPlans(userId: string, limit = 6) {
  const goals = await db.goal.findMany({
    where: { userId, status: "active" },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: {
      id: true,
      title: true,
      pillar: true,
      targetDate: true,
      milestones: {
        orderBy: { position: "asc" },
        select: { title: true, completedAt: true },
      },
      tasks: {
        where: { completedAt: null },
        orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
        take: 5,
        select: { title: true, dueDate: true },
      },
    },
  });
  return goals.map((goal) => ({
    id: goal.id,
    title: goal.title,
    pillar: goal.pillar,
    targetDate: goal.targetDate ? fromDbDate(goal.targetDate) : null,
    milestones: goal.milestones.map((milestone) => ({
      title: milestone.title,
      done: milestone.completedAt !== null,
    })),
    openTasks: goal.tasks.map((task) => ({
      title: task.title,
      dueDate: task.dueDate ? fromDbDate(task.dueDate) : null,
    })),
  }));
}

export type GoalDetail = GoalSummary & {
  description: string | null;
  completedAt: Date | null;
  milestones: { id: string; title: string; done: boolean }[];
  tasks: { id: string; title: string; dueDate: string | null; done: boolean }[];
};

/** Un objectif avec ses jalons et ses tâches, ou null s'il n'existe pas pour cet utilisateur. */
export async function getGoal(
  userId: string,
  goalId: string,
): Promise<GoalDetail | null> {
  const goal = await db.goal.findFirst({
    where: { id: goalId, userId },
    select: {
      ...summarySelect,
      description: true,
      completedAt: true,
      milestones: {
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        select: { id: true, title: true, completedAt: true },
      },
      tasks: {
        // À faire d'abord (par échéance), puis les tâches terminées
        orderBy: [
          { completedAt: { sort: "asc", nulls: "first" } },
          { dueDate: { sort: "asc", nulls: "last" } },
          { createdAt: "asc" },
        ],
        select: { id: true, title: true, dueDate: true, completedAt: true },
      },
    },
  });
  if (!goal) return null;
  const photo = await avatarUrl(goal.photoPath);
  const photos = new Map(
    goal.photoPath && photo ? [[goal.photoPath, photo]] : [],
  );

  return {
    ...toSummary(goal, photos),
    description: goal.description,
    completedAt: goal.completedAt,
    milestones: goal.milestones.map((m) => ({
      id: m.id,
      title: m.title,
      done: m.completedAt !== null,
    })),
    tasks: goal.tasks.map((task) => ({
      id: task.id,
      title: task.title,
      dueDate: task.dueDate ? fromDbDate(task.dueDate) : null,
      done: task.completedAt !== null,
    })),
  };
}

type GoalFields = {
  title: string;
  description: string | null;
  pillar: Pillar;
  /** « AAAA-MM-JJ » */
  targetDate: string | null;
};

function toGoalData(input: GoalFields) {
  return {
    title: input.title,
    description: input.description,
    pillar: input.pillar,
    targetDate: input.targetDate ? toDbDate(input.targetDate) : null,
  };
}

type Client = Prisma.TransactionClient | typeof db;

/**
 * Vrai si l'aspect a encore de la place pour un objectif en cours (3 au plus,
 * pour garder le cap sur l'essentiel). `exceptGoalId` : l'objectif modifié.
 */
export async function hasActiveGoalRoom(
  client: Client,
  userId: string,
  pillar: Pillar,
  exceptGoalId?: string,
) {
  const count = await client.goal.count({
    where: {
      userId,
      pillar,
      status: "active",
      ...(exceptGoalId ? { id: { not: exceptGoalId } } : {}),
    },
  });
  return count < ACTIVE_GOALS_PER_PILLAR;
}

/** Crée un objectif et renvoie son id, sauf si l'aspect a déjà 3 objectifs en cours. */
export async function createGoal(
  userId: string,
  input: GoalFields,
): Promise<{ ok: true; id: string } | { ok: false; error: "goalLimit" }> {
  if (!(await hasActiveGoalRoom(db, userId, input.pillar))) {
    return { ok: false, error: "goalLimit" };
  }
  const goal = await db.goal.create({
    data: { userId, ...toGoalData(input) },
    select: { id: true },
  });
  return { ok: true, id: goal.id };
}

/**
 * Modifie un objectif. Faux s'il n'existe pas pour cet utilisateur ;
 * « goalLimit » si un objectif en cours change pour un aspect déjà plein.
 */
export async function updateGoal(
  userId: string,
  goalId: string,
  input: GoalFields,
): Promise<boolean | "goalLimit"> {
  return db.$transaction(async (tx) => {
    const current = await tx.goal.findFirst({
      where: { id: goalId, userId },
      select: { status: true, pillar: true },
    });
    if (!current) return false;
    if (
      current.status === "active" &&
      current.pillar !== input.pillar &&
      !(await hasActiveGoalRoom(tx, userId, input.pillar, goalId))
    ) {
      return "goalLimit";
    }
    const { count } = await tx.goal.updateMany({
      where: { id: goalId, userId },
      data: toGoalData(input),
    });
    if (count === 0) return false;
    // L'XP déjà gagnée (objectif, jalons, tâches) suit le pilier de l'objectif
    await tx.xpEvent.updateMany({
      where: {
        userId,
        OR: [{ goalId }, { milestone: { goalId } }, { task: { goalId } }],
      },
      data: { pillar: input.pillar },
    });
    return true;
  });
}

/**
 * Atteint (+ XP), repris (XP retirée) ou archivé. Archiver garde la date
 * d'atteinte et l'XP.
 */
export async function setGoalStatus(
  userId: string,
  goalId: string,
  status: GoalStatus,
) {
  const data =
    status === "completed"
      ? { status, completedAt: new Date() }
      : status === "active"
        ? { status, completedAt: null }
        : { status };
  const timeZone =
    status === "completed" ? await getUserTimeZone(userId) : null;

  return db.$transaction(async (tx): Promise<boolean | "goalLimit"> => {
    // Reprendre un objectif : seulement s'il reste de la place dans l'aspect
    if (status === "active") {
      const goal = await tx.goal.findFirst({
        where: { id: goalId, userId },
        select: { status: true, pillar: true },
      });
      if (!goal) return false;
      if (
        goal.status !== "active" &&
        !(await hasActiveGoalRoom(tx, userId, goal.pillar, goalId))
      ) {
        return "goalLimit";
      }
    }
    const { count } = await tx.goal.updateMany({
      where: { id: goalId, userId },
      data,
    });
    if (count === 0) return false;
    if (timeZone) {
      const goal = await tx.goal.findUniqueOrThrow({
        where: { id: goalId },
        select: { pillar: true },
      });
      await awardGoal(tx, goalId, {
        userId,
        amount: XP_REWARDS.goal,
        pillar: goal.pillar,
        day: toCalendarDay(new Date(), timeZone),
      });
    } else if (status === "active") {
      await revokeXp(tx, userId, { goalId });
    }
    return true;
  });
}

/** Supprime un objectif, ses jalons et ses tâches (cascade). */
export async function deleteGoal(userId: string, goalId: string) {
  const goal = await db.goal.findFirst({
    where: { id: goalId, userId },
    select: { photoPath: true },
  });
  if (!goal) return false;
  await db.goal.deleteMany({ where: { id: goalId, userId } });
  if (goal.photoPath) {
    await removeFiles([goal.photoPath]).catch(() => undefined);
  }
  return true;
}

/** Ajoute un jalon à la fin de l'objectif. Faux si l'objectif n'existe pas pour cet utilisateur. */
export async function addMilestone(
  userId: string,
  goalId: string,
  title: string,
) {
  return db.$transaction(async (tx) => {
    const goal = await tx.goal.findFirst({
      where: { id: goalId, userId },
      select: {
        milestones: {
          orderBy: { position: "desc" },
          take: 1,
          select: { position: true },
        },
      },
    });
    if (!goal) return false;

    await tx.goalMilestone.create({
      data: {
        goalId,
        title,
        position: (goal.milestones[0]?.position ?? -1) + 1,
      },
    });
    return true;
  });
}

export async function setMilestoneDone(
  userId: string,
  milestoneId: string,
  done: boolean,
) {
  if (!done) {
    await db.$transaction(async (tx) => {
      await tx.goalMilestone.updateMany({
        where: { id: milestoneId, goal: { userId } },
        data: { completedAt: null },
      });
      await revokeXp(tx, userId, { milestoneId });
    });
    return;
  }

  const timeZone = await getUserTimeZone(userId);
  await db.$transaction(async (tx) => {
    // Déjà terminé : la date d'origine (et son XP) sont conservées
    const { count } = await tx.goalMilestone.updateMany({
      where: { id: milestoneId, goal: { userId }, completedAt: null },
      data: { completedAt: new Date() },
    });
    if (count === 0) return;
    const milestone = await tx.goalMilestone.findUniqueOrThrow({
      where: { id: milestoneId },
      select: { goal: { select: { pillar: true } } },
    });
    await awardMilestone(tx, milestoneId, {
      userId,
      amount: XP_REWARDS.milestone,
      pillar: milestone.goal.pillar,
      day: toCalendarDay(new Date(), timeZone),
    });
  });
}

export async function deleteMilestone(userId: string, milestoneId: string) {
  await db.goalMilestone.deleteMany({
    where: { id: milestoneId, goal: { userId } },
  });
}
