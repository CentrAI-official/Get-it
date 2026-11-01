import "server-only";
import type { DayMoment } from "@/config/moments";
import type { Pillar } from "@/config/pillars";
import { fromDbDate, toCalendarDay, toDbDate } from "@/lib/dates";
import { db } from "@/server/db";

// Chaque fonction reçoit l'userId de la session et filtre dessus.

export type DayTask = {
  id: string;
  title: string;
  /** « AAAA-MM-JJ » */
  dueDate: string | null;
  done: boolean;
  /** Heure prévue (minutes depuis minuit) ; null : pas d’heure. */
  time: number | null;
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
      timeMinute: true,
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
    time: task.timeMinute,
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

/**
 * Termine une tâche ou la rouvre. Déjà terminée : la date d'origine est
 * conservée (elle compte pour la série de ce jour-là).
 */
export async function setTaskDone(
  userId: string,
  taskId: string,
  done: boolean,
) {
  await db.task.updateMany({
    where: done
      ? { id: taskId, userId, completedAt: null }
      : { id: taskId, userId },
    data: { completedAt: done ? new Date() : null },
  });
}

/**
 * Modifie une tâche depuis le calendrier : titre, échéance, heure et moment.
 * Faux si elle n'existe pas pour cet utilisateur.
 */
export async function updateTask(
  userId: string,
  taskId: string,
  input: {
    title: string;
    dueDate: string | null;
    time: number | null;
    moment: DayMoment | null;
  },
) {
  const { count } = await db.task.updateMany({
    where: { id: taskId, userId },
    data: {
      title: input.title,
      dueDate: input.dueDate ? toDbDate(input.dueDate) : null,
      timeMinute: input.time,
      moment: input.moment,
    },
  });
  return count > 0;
}

export async function deleteTask(userId: string, taskId: string) {
  await db.task.deleteMany({ where: { id: taskId, userId } });
}
