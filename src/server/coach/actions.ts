import "server-only";
import {
  coachActionPayloadSchema,
  type CoachActionPayload,
  type CoachActionView,
} from "@/features/coach/coach-tools";
import { db } from "@/server/db";
import { addMilestone, createGoal } from "@/server/goals/service";
import { createHabit } from "@/server/habits/service";
import { addTask } from "@/server/tasks/service";

export type ResolveResult =
  | { ok: true; status: CoachActionView["status"]; createdId: string | null }
  | {
      ok: false;
      error: "notFound" | "goalMissing" | "goalLimit" | "unexpected";
    };

/**
 * Crée l'élément proposé, avec les mêmes services (et contrôles) que les
 * formulaires. Renvoie l'id créé (objectif, habitude), null pour une tâche ou
 * un jalon, false si l'objectif lié n'existe plus, ou « goalLimit » si
 * l'aspect a déjà 3 objectifs en cours.
 */
async function create(
  userId: string,
  payload: CoachActionPayload,
): Promise<string | null | false | "goalLimit"> {
  switch (payload.kind) {
    case "goal": {
      const created = await createGoal(userId, {
        title: payload.title,
        description: payload.description,
        pillar: payload.pillar,
        targetDate: payload.targetDate,
      });
      return created.ok ? created.id : created.error;
    }
    case "habit":
      return (
        (await createHabit(userId, {
          title: payload.title,
          pillar: payload.pillar,
          weekdays: payload.weekdays,
          goalId: payload.goal?.id ?? null,
          moment: null,
        })) ?? false
      );
    case "task":
      return (await addTask(userId, {
        title: payload.title,
        dueDate: payload.dueDate,
        goalId: payload.goal?.id ?? null,
      }))
        ? null
        : false;
    case "milestone":
      return (await addMilestone(userId, payload.goal.id, payload.title))
        ? null
        : false;
  }
}

/**
 * Ajoute ou ignore une proposition de Get iT AI. Une seule décision par
 * proposition : un double clic ne crée jamais deux fois le même élément.
 */
export async function resolveCoachAction(
  userId: string,
  actionId: string,
  decision: "apply" | "dismiss",
): Promise<ResolveResult> {
  const action = await db.coachAction.findFirst({
    where: { id: actionId, userId },
    select: { status: true, createdId: true, payload: true },
  });
  if (!action) return { ok: false, error: "notFound" };
  const payload = coachActionPayloadSchema.safeParse(action.payload);
  if (!payload.success) return { ok: false, error: "unexpected" };

  const target = decision === "apply" ? "applied" : "dismissed";
  // Réserve la décision : seule la première, encore « en attente », passe
  const { count } = await db.coachAction.updateMany({
    where: { id: actionId, userId, status: "pending" },
    data: { status: target },
  });
  if (count === 0) {
    return { ok: true, status: action.status, createdId: action.createdId };
  }
  if (decision === "dismiss") {
    return { ok: true, status: "dismissed", createdId: null };
  }

  let createdId: string | null | false | "goalLimit" = false;
  let failure: "goalMissing" | "goalLimit" | "unexpected" | null = null;
  try {
    createdId = await create(userId, payload.data);
    if (createdId === false) failure = "goalMissing";
    if (createdId === "goalLimit") failure = "goalLimit";
  } catch (error) {
    console.error("Ajout de la proposition impossible", error);
    failure = "unexpected";
  }
  if (failure) {
    // Rien n'a été créé : la proposition redevient disponible
    await db.coachAction.updateMany({
      where: { id: actionId, userId },
      data: { status: "pending" },
    });
    return { ok: false, error: failure };
  }
  if (createdId) {
    await db.coachAction.updateMany({
      where: { id: actionId, userId },
      data: { createdId },
    });
  }
  return { ok: true, status: "applied", createdId: createdId || null };
}
