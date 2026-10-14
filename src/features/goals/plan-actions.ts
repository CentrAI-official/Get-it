"use server";

import { refresh } from "next/cache";
import { requireUser } from "@/server/auth/session";
import {
  applyGoalPlan,
  generateGoalPlan,
  type GoalPlanError,
} from "@/server/goals/plan";
import { goalPlanSelectionSchema, type GoalPlan } from "./plan";
import { recordIdSchema } from "./schemas";

// Points d'entrée publics : session, identifiants et sélection revalidés ici.

export type GeneratePlanResult =
  | { status: "success"; plan: GoalPlan; remaining: number }
  | { status: "error"; error: GoalPlanError };

/** Demande un plan à Get iT AI (ne crée rien). */
export async function generateGoalPlanAction(
  goalId: string,
): Promise<GeneratePlanResult> {
  const user = await requireUser();
  const id = recordIdSchema.safeParse(goalId);
  if (!id.success) return { status: "error", error: "notFound" };

  try {
    const result = await generateGoalPlan(user.id, id.data);
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
