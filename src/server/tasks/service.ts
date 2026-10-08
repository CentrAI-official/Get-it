import "server-only";
import { toDbDate } from "@/lib/dates";
import { db } from "@/server/db";

// Chaque fonction reçoit l'userId de la session et filtre dessus.

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

export async function setTaskDone(
  userId: string,
  taskId: string,
  done: boolean,
) {
  await db.task.updateMany({
    // Déjà terminée : la date d'origine est conservée
    where: { id: taskId, userId, ...(done ? { completedAt: null } : {}) },
    data: { completedAt: done ? new Date() : null },
  });
}

export async function deleteTask(userId: string, taskId: string) {
  await db.task.deleteMany({ where: { id: taskId, userId } });
}
