"use server";

import { refresh } from "next/cache";
import { requireUser } from "@/server/auth/session";
import {
  applyGoalPlan,
  generateGoalPlan,
  generateGoalQuestions,
  type GoalPlanError,
} from "@/server/goals/plan";
import {
  goalAnswersSchema,
  goalPlanSelectionSchema,
  type GoalPlan,
  type GoalQuestions,
} from "./plan";
import { recordIdSchema } from "./schemas";

// Points d'entrée publics : session, identifiants et sélection revalidés ici.

export type GeneratePlanResult =
  | { status: "success"; plan: GoalPlan; remaining: number }
  | { status: "error"; error: GoalPlanError };

export type GenerateQuestionsResult =
  | { status: "success"; questions: GoalQuestions; remaining: number }
  | { status: "error"; error: GoalPlanError };

/** Demande à Get iT AI ses questions avant le plan (ne crée rien). */
export async function generateGoalQuestionsAction(
  goalId: string,
): Promise<GenerateQuestionsResult> {
  const user = await requireUser();
  const id = recordIdSchema.safeParse(goalId);
  if (!id.success) return { status: "error", error: "notFound" };
  try {
    const result = await generateGoalQuestions(user.id, id.data);
    return result.ok
      ? {
          status: "success",
          questions: result.questions,
          remaining: result.remaining,
        }
      : { status: "error", error: result.error };
  } catch (error) {
    console.error("Questions de Get iT AI impossibles", error);
    return { status: "error", error: "unexpected" };
  }
}

/** Demande un plan à Get iT AI, avec les réponses aux questions (ne crée rien). */
export async function generateGoalPlanAction(
  goalId: string,
  answers: unknown = [],
): Promise<GeneratePlanResult> {
  const user = await requireUser();
  const id = recordIdSchema.safeParse(goalId);
  const parsed = goalAnswersSchema.safeParse(answers);
  if (!id.success) return { status: "error", error: "notFound" };
  if (!parsed.success) return { status: "error", error: "unexpected" };

  try {
    const result = await generateGoalPlan(user.id, id.data, parsed.data);
    return result.ok
      ? { status: "success", plan: result.plan, remaining: result.remaining }
      : { status: "error", error: result.error };
  } catch (error) {
    console.error("Plan de Get iT AI impossible", error);
    return { status: "error", error: "unexpected" };
  }
}

/** Ajoute à l'objectif les éléments du plan que l'utilisateur garde. */
export async function applyGoalPlanAction(
  goalId: string,
  selection: unknown,
): Promise<{ status: "success" | "error" }> {
  const user = await requireUser();
  const id = recordIdSchema.safeParse(goalId);
  const parsed = goalPlanSelectionSchema.safeParse(selection);
  if (!id.success || !parsed.success) return { status: "error" };

  try {
    const applied = await applyGoalPlan(user.id, id.data, parsed.data);
    if (!applied) return { status: "error" };
  } catch (error) {
    console.error("Ajout du plan impossible", error);
    return { status: "error" };
  }
  refresh();
  return { status: "success" };
}
