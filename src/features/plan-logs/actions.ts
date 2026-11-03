"use server";

import { refresh, revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth/session";
import {
  addPlanItemToBudget,
  removePlanItemFromBudget,
  setPlanItem,
  type PlanLogResult,
} from "@/server/plan-logs/service";
import {
  planBudgetSchema,
  planBudgetTargetSchema,
  planLogSchema,
} from "./rules";

// Points d'entrée publics : session et saisies revalidées ici. Le serveur relit
// l'élément dans le plan, jamais dans ce que le navigateur envoie.

/** Un virement ajouté ou retiré change aussi la page du budget. */
const BUDGET_PAGE = "/[locale]/services/financial/budget";

const guarded = async (
  run: () => Promise<PlanLogResult>,
  { budget }: { budget: boolean },
) => {
  try {
    const result = await run();
    if (result.ok) {
      if (budget) revalidatePath(BUDGET_PAGE, "page");
      refresh();
    }
    return result;
  } catch (error) {
    console.error("Élément du plan non enregistré", error);
    return { ok: false, error: "unexpected" } as const;
  }
};

/** Coche, précise ou décoche un élément d'un plan. */
export async function savePlanLogAction(
  input: unknown,
): Promise<PlanLogResult> {
  const user = await requireUser();
  const parsed = planLogSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return guarded(() => setPlanItem(user.id, parsed.data), {
    // Décocher une action retire ce qu'elle avait ajouté au budget
    budget: parsed.data.kind === "financial" && !parsed.data.done,
  });
}

/** « Ajouter au budget » : le virement d'épargne fait. */
export async function addPlanLogToBudgetAction(
  input: unknown,
): Promise<PlanLogResult> {
  const user = await requireUser();
  const parsed = planBudgetSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return guarded(() => addPlanItemToBudget(user.id, parsed.data), {
    budget: true,
  });
}

/** Retire le virement du budget ; l'action reste cochée. */
export async function removePlanLogFromBudgetAction(
  input: unknown,
): Promise<PlanLogResult> {
  const user = await requireUser();
  const parsed = planBudgetTargetSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return guarded(() => removePlanItemFromBudget(user.id, parsed.data), {
    budget: true,
  });
}
