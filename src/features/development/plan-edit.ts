import { WEEKDAYS } from "@/features/habits/schemas";
import {
  DEVELOPMENT_PLAN_LIMITS,
  type DevelopmentPlan,
  type PlanItem,
} from "./plan";

// « Ajouter à mon plan » et « Remplacer… » depuis une fiche du catalogue
// (décision du fondateur, 2026-11-01) : sans IA, le plan enregistré est
// modifié directement. Fonctions pures, testées dans development.test.ts.

export type PlanEditError = "dayFull" | "itemMissing" | "invalidDay";

/** Séparateur du repas et du plat dans un plan de nutrition (« Souper — Bol… »). */
const MEAL_SEPARATOR = " — ";

/**
 * Ajoute un élément à la séance d'un jour ; s'il n'y en a pas ce jour-là, une
 * séance est créée avec `sessionTitle` (la semaine reste triée).
 */
export function addPlanItem(
  plan: DevelopmentPlan,
  input: { weekday: number; item: PlanItem; sessionTitle: string },
): { ok: true; plan: DevelopmentPlan } | { ok: false; error: PlanEditError } {
  if (!WEEKDAYS.includes(input.weekday as (typeof WEEKDAYS)[number])) {
    return { ok: false, error: "invalidDay" };
  }
  const day = plan.schedule.find((entry) => entry.weekday === input.weekday);
  if (day && day.items.length >= DEVELOPMENT_PLAN_LIMITS.itemsPerDay) {
    return { ok: false, error: "dayFull" };
  }
  const schedule = day
    ? plan.schedule.map((entry) =>
        entry === day
          ? { ...entry, items: [...entry.items, input.item] }
          : entry,
      )
    : [
        ...plan.schedule,
        {
          weekday: input.weekday,
          moment: null,
          time: null,
          title: input.sessionTitle,
          items: [input.item],
        },
      ].sort((a, b) => a.weekday - b.weekday);
  return { ok: true, plan: { ...plan, schedule } };
}

/**
 * Remplace un élément d'une séance par un élément du catalogue. Les séries et
 * répétitions (le détail) sont gardées ; dans un menu, le repas aussi
 * (« Souper — » reste devant le nouveau plat).
 */
export function replacePlanItem(
  plan: DevelopmentPlan,
  input: { weekday: number; index: number; item: PlanItem },
): { ok: true; plan: DevelopmentPlan } | { ok: false; error: PlanEditError } {
  const day = plan.schedule.find((entry) => entry.weekday === input.weekday);
  const current = day?.items[input.index];
  if (!day || !current) return { ok: false, error: "itemMissing" };
  const meal = current.name.includes(MEAL_SEPARATOR)
    ? current.name.slice(0, current.name.indexOf(MEAL_SEPARATOR))
    : null;
  const replacement: PlanItem = {
    name:
      meal && !input.item.name.includes(MEAL_SEPARATOR)
        ? `${meal}${MEAL_SEPARATOR}${input.item.name}`
        : input.item.name,
    detail: current.detail || input.item.detail,
    ref: input.item.ref,
  };
  return {
    ok: true,
    plan: {
      ...plan,
      schedule: plan.schedule.map((entry) =>
        entry === day
          ? {
              ...entry,
              items: entry.items.map((item, index) =>
                index === input.index ? replacement : item,
              ),
            }
          : entry,
      ),
    },
  };
}

/** Nom d'un plat ajouté à un menu : « Souper — Bol de riz au saumon ». */
export const mealItemName = (meal: string, title: string) =>
  `${meal}${MEAL_SEPARATOR}${title}`;
