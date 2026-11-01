import "server-only";
import type { Pillar } from "@/config/pillars";
import type { LevelFactor } from "@/features/levels/factors";
import {
  ACTIVE_GOALS_PER_PILLAR,
  type GoalStatus,
} from "@/features/goals/schemas";
import { fromDbDate, toCalendarDay, toDbDate } from "@/lib/dates";
import type { GoalKind, Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { avatarUrl, avatarUrls } from "@/server/profile/avatar";
import { removeFiles } from "@/server/storage/service";

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
  /**
   * Objectif de niveau (calculé d'après la population) : la mesure et le
   * niveau qu'il fait atteindre ; null pour un objectif personnel.
   */
  levelGoal: { factor: LevelFactor; level: number } | null;
};

const summarySelect = {
  id: true,
  title: true,
  pillar: true,
  status: true,
  targetDate: true,
  photoPath: true,
  kind: true,
  levelFactor: true,
  level: true,
  milestones: { select: { completedAt: true } },
} as const;

type SummaryRow = {
  id: string;
  title: string;
  pillar: Pillar;
  status: GoalStatus;
  targetDate: Date | null;
  photoPath: string | null;
  kind: GoalKind;
  levelFactor: string | null;
  level: number | null;
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
    levelGoal:
      goal.kind === "level" && goal.levelFactor && goal.level !== null
        ? { factor: goal.levelFactor as LevelFactor, level: goal.level }
        : null,
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

/**
 * Objectifs en cours pour l'Aperçu du Profil : la date visée la plus proche
 * d'abord (sans date à la fin), avec le jour de création dans le fuseau de la
 * personne (point de départ du rythme, `goalPace`).
 */
export async function listGoalsInProgress(
  userId: string,
  timeZone: string,
  limit = 3,
) {
  const goals = await db.goal.findMany({
    where: { userId, status: "active" },
    orderBy: [
      { targetDate: { sort: "asc", nulls: "last" } },
      { createdAt: "asc" },
    ],
    take: limit,
    select: {
      id: true,
      title: true,
      targetDate: true,
      createdAt: true,
      milestones: { select: { completedAt: true } },
    },
  });
  return goals.map((goal) => ({
    id: goal.id,
    title: goal.title,
    targetDate: goal.targetDate ? fromDbDate(goal.targetDate) : null,
    startedOn: toCalendarDay(goal.createdAt, timeZone),
    milestonesDone: goal.milestones.filter((m) => m.completedAt).length,
    milestonesTotal: goal.milestones.length,
  }));
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
      // Les objectifs de niveau ne prennent pas de place
      kind: "personal",
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
    // Un objectif de niveau ne se modifie pas : sa valeur vient de la population
    const current = await tx.goal.findFirst({
      where: { id: goalId, userId, kind: "personal" },
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
      where: { id: goalId, userId, kind: "personal" },
      data: toGoalData(input),
    });
    return count > 0;
  });
}

/**
 * Atteint, repris ou archivé. Archiver garde la date d'atteinte. Un objectif
 * de niveau ne change d'état que par une mesure (src/server/levels/service.ts).
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

  return db.$transaction(async (tx): Promise<boolean | "goalLimit"> => {
    // Reprendre un objectif : seulement s'il reste de la place dans l'aspect
    if (status === "active") {
      const goal = await tx.goal.findFirst({
        where: { id: goalId, userId, kind: "personal" },
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
      where: { id: goalId, userId, kind: "personal" },
      data,
    });
    return count > 0;
  });
}

/**
 * Supprime un objectif personnel, ses jalons et ses tâches (cascade). Un
 * objectif de niveau ne se supprime pas (il disparaît avec les mesures).
 */
export async function deleteGoal(userId: string, goalId: string) {
  const goal = await db.goal.findFirst({
    where: { id: goalId, userId, kind: "personal" },
    select: { photoPath: true },
  });
  if (!goal) return false;
  await db.goal.deleteMany({ where: { id: goalId, userId, kind: "personal" } });
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
  // Déjà terminé : la date d'origine est conservée (elle compte pour la série)
  await db.goalMilestone.updateMany({
    where: done
      ? { id: milestoneId, goal: { userId }, completedAt: null }
      : { id: milestoneId, goal: { userId } },
    data: { completedAt: done ? new Date() : null },
  });
}

export async function deleteMilestone(userId: string, milestoneId: string) {
  await db.goalMilestone.deleteMany({
    where: { id: milestoneId, goal: { userId } },
  });
}
