"use server";

import { refresh } from "next/cache";
import {
  firstGoalError,
  recordIdSchema,
  type ItemFormState,
} from "@/features/goals/schemas";
import { requireUser } from "@/server/auth/session";
import { addTask, deleteTask, setTaskDone } from "@/server/tasks/service";
import { taskFormSchema } from "./schemas";

// Points d'entrée publics : session, identifiants et saisies sont revalidés ici.

/** Ajoute une tâche ; `goalId` null pour une tâche indépendante. */
export async function addTaskAction(
  goalId: string | null,
  _previous: ItemFormState,
  formData: FormData,
): Promise<ItemFormState> {
  const user = await requireUser();
  const id = goalId === null ? null : recordIdSchema.safeParse(goalId);
  if (id && !id.success) return { status: "error", error: "notFound" };

  const read = (name: string) => {
    const value = formData.get(name);
    return typeof value === "string" ? value : undefined;
  };
  const values = { title: read("title"), dueDate: read("dueDate") };
  const parsed = taskFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { status: "error", error: firstGoalError(parsed.error), values };
  }

  try {
    const added = await addTask(user.id, {
      ...parsed.data,
      goalId: id ? id.data : null,
    });
    if (!added) return { status: "error", error: "notFound" };
  } catch (error) {
    console.error("Ajout de la tâche impossible", error);
    return { status: "error", error: "unexpected", values };
  }
  refresh();
  return { status: "success" };
}

export async function setTaskDoneAction(taskId: string, done: boolean) {
  const user = await requireUser();
  const id = recordIdSchema.safeParse(taskId);
  if (!id.success || typeof done !== "boolean") return;

  try {
    await setTaskDone(user.id, id.data, done);
  } catch (error) {
    console.error("Mise à jour de la tâche impossible", error);
  }
  refresh();
}

export async function deleteTaskAction(taskId: string) {
  const user = await requireUser();
  const id = recordIdSchema.safeParse(taskId);
  if (!id.success) return;

  try {
    await deleteTask(user.id, id.data);
  } catch (error) {
    console.error("Suppression de la tâche impossible", error);
  }
  refresh();
}
