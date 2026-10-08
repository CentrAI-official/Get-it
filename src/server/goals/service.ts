import "server-only";
import type { Pillar } from "@/config/pillars";
import type { GoalStatus } from "@/features/goals/schemas";
import { fromDbDate, toDbDate } from "@/lib/dates";
import { db } from "@/server/db";

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
};

const summarySelect = {
  id: true,
  title: true,
  pillar: true,
  status: true,
  targetDate: true,
  milestones: { select: { completedAt: true } },
} as const;

type SummaryRow = {
  id: string;
  title: string;
  pillar: Pillar;
  status: GoalStatus;
  targetDate: Date | null;
  milestones: { completedAt: Date | null }[];
};

function toSummary(goal: SummaryRow): GoalSummary {
  return {
    id: goal.id,
    title: goal.title,
    pillar: goal.pillar,
    status: goal.status,
    targetDate: goal.targetDate ? fromDbDate(goal.targetDate) : null,
    milestonesDone: goal.milestones.filter((m) => m.completedAt).length,
    milestonesTotal: goal.milestones.length,
  };
}

/** Tous les objectifs, du plus ancien au plus récent. */
export async function listGoals(userId: string): Promise<GoalSummary[]> {
  const goals = await db.goal.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: summarySelect,
  });
  return goals.map(toSummary);
}

/** Objectifs en cours, du plus ancien au plus récent. */
export async function listActiveGoals(userId: string): Promise<GoalSummary[]> {
  const goals = await db.goal.findMany({
    where: { userId, status: "active" },
    orderBy: { createdAt: "asc" },
    select: summarySelect,
  });
  return goals.map(toSummary);
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

  return {
    ...toSummary(goal),
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

/** Crée un objectif et renvoie son id. */
export async function createGoal(userId: string, input: GoalFields) {
  const goal = await db.goal.create({
    data: { userId, ...toGoalData(input) },
    select: { id: true },
  });
  return goal.id;
}

/** Modifie un objectif. Faux s'il n'existe pas pour cet utilisateur. */
export async function updateGoal(
  userId: string,
  goalId: string,
  input: GoalFields,
) {
  const { count } = await db.goal.updateMany({
    where: { id: goalId, userId },
    data: toGoalData(input),
  });
  return count > 0;
}

/** Atteint, repris ou archivé. Archiver garde la date d'atteinte. */
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
  const { count } = await db.goal.updateMany({
    where: { id: goalId, userId },
    data,
  });
  return count > 0;
}

/** Supprime un objectif, ses jalons et ses tâches (cascade). */
export async function deleteGoal(userId: string, goalId: string) {
  const { count } = await db.goal.deleteMany({
    where: { id: goalId, userId },
  });
  return count > 0;
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
  await db.goalMilestone.updateMany({
    // Déjà terminé : la date d'origine est conservée
    where: {
      id: milestoneId,
      goal: { userId },
      ...(done ? { completedAt: null } : {}),
    },
    data: { completedAt: done ? new Date() : null },
  });
}

export async function deleteMilestone(userId: string, milestoneId: string) {
  await db.goalMilestone.deleteMany({
    where: { id: milestoneId, goal: { userId } },
  });
}
