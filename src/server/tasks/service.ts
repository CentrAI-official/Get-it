import "server-only";
import type { DayMoment } from "@/config/moments";
import type { Pillar } from "@/config/pillars";
import { XP_REWARDS } from "@/features/xp/rules";
import { fromDbDate, toCalendarDay, toDbDate } from "@/lib/dates";
import { db } from "@/server/db";
import { getUserTimeZone } from "@/server/profile/service";
import { awardTask, revokeXp } from "@/server/xp/service";

// Chaque fonction reçoit l'userId de la session et filtre dessus.

export type DayTask = {
  id: string;
  title: string;
  /** « AAAA-MM-JJ » */
  dueDate: string | null;
  done: boolean;
  /** Objectif de la tâche : il lui donne son pilier. */
  goal: { id: string; title: string; pillar: Pillar } | null;
};

/**
 * Tâches de la page Aujourd'hui : celles dues aujourd'hui (faites ou non) et
 * celles en retard encore à faire ou faites aujourd'hui (elles restent dans la
 * journée jusqu'à minuit), les plus anciennes d'abord.
 */
export async function listDayTasks(
  userId: string,
  today: string,
  timeZone: string,
): Promise<DayTask[]> {
  const day = toDbDate(today);
  const rows = await db.task.findMany({
    where: {
      userId,
      OR: [
        { dueDate: day },
        { dueDate: { lt: day }, completedAt: null },
        // Faites depuis au plus 48 h : le jour exact est vérifié dans le fuseau
        {
          dueDate: { lt: day },
          completedAt: { gte: new Date(day.getTime() - 2 * 86_400_000) },
        },
      ],
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      title: true,
      dueDate: true,
      completedAt: true,
      goal: { select: { id: true, title: true, pillar: true } },
    },
  });

  const tasks = rows.filter(
    (task) =>
      task.completedAt === null ||
      (task.dueDate !== null && task.dueDate.getTime() === day.getTime()) ||
      toCalendarDay(task.completedAt, timeZone) === today,
  );
  return tasks.map((task) => ({
    id: task.id,
    title: task.title,
    dueDate: task.dueDate ? fromDbDate(task.dueDate) : null,
    done: task.completedAt !== null,
    goal: task.goal,
  }));
}

/**
 * Tâches d'objectifs dues entre `from` et `to` inclus, faites ou non :
 * la régularité de chaque pilier (score de la page Aujourd'hui).
 */
export async function listGoalTasksDueBetween(
  userId: string,
  from: string,
  to: string,
): Promise<{ dueDate: string; done: boolean; pillar: Pillar }[]> {
  const tasks = await db.task.findMany({
    where: {
      userId,
      dueDate: { gte: toDbDate(from), lte: toDbDate(to) },
      goal: { isNot: null },
    },
    select: {
      dueDate: true,
      completedAt: true,
      goal: { select: { pillar: true } },
    },
  });

  return tasks.flatMap((task) =>
    task.dueDate && task.goal
      ? [
          {
            dueDate: fromDbDate(task.dueDate),
            done: task.completedAt !== null,
            pillar: task.goal.pillar,
          },
        ]
      : [],
  );
}

/**
 * Ajoute une tâche, rattachée à un objectif ou non. Faux si l'objectif
 * indiqué n'existe pas pour cet utilisateur.
 */
export async function addTask(
  userId: string,
  input: { title: string; dueDate: string | null; goalId: string | null },
) {
  if (input.goalId) {
    const goal = await db.goal.findFirst({
      where: { id: input.goalId, userId },
      select: { id: true },
    });
    if (!goal) return false;
  }

  await db.task.create({
    data: {
      userId,
      goalId: input.goalId,
      title: input.title,
      dueDate: input.dueDate ? toDbDate(input.dueDate) : null,
    },
  });
  return true;
}

/** Moment de la journée d'une tâche (calendrier « Semaine »). Faux si elle n'existe pas. */
export async function setTaskMoment(
  userId: string,
  taskId: string,
  moment: DayMoment | null,
) {
  const { count } = await db.task.updateMany({
    where: { id: taskId, userId },
    data: { moment },
  });
  return count > 0;
}

/**
 * Termine une tâche (avec son XP, dans la limite quotidienne) ou la rouvre
 * (son XP est retirée).
 */
export async function setTaskDone(
  userId: string,
  taskId: string,
  done: boolean,
) {
  if (!done) {
    await db.$transaction(async (tx) => {
      await tx.task.updateMany({
        where: { id: taskId, userId },
        data: { completedAt: null },
      });
      await revokeXp(tx, userId, { taskId });
    });
    return;
  }

  const timeZone = await getUserTimeZone(userId);
  await db.$transaction(async (tx) => {
    // Déjà terminée : la date d'origine (et son XP) sont conservées
    const { count } = await tx.task.updateMany({
      where: { id: taskId, userId, completedAt: null },
      data: { completedAt: new Date() },
    });
    if (count === 0) return;
    const task = await tx.task.findUniqueOrThrow({
      where: { id: taskId },
      select: { goal: { select: { pillar: true } } },
    });
    await awardTask(tx, taskId, {
      userId,
      amount: XP_REWARDS.task,
      pillar: task.goal?.pillar ?? null,
      day: toCalendarDay(new Date(), timeZone),
    });
  });
}

/** Renomme une tâche ou change son échéance. Faux si elle n'existe pas pour cet utilisateur. */
export async function updateTask(
  userId: string,
  taskId: string,
  input: { title: string; dueDate: string | null },
) {
  const { count } = await db.task.updateMany({
    where: { id: taskId, userId },
    data: {
      title: input.title,
      dueDate: input.dueDate ? toDbDate(input.dueDate) : null,
    },
  });
  return count > 0;
}

export async function deleteTask(userId: string, taskId: string) {
  await db.task.deleteMany({ where: { id: taskId, userId } });
}
