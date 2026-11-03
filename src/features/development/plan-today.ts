import { addDays } from "@/lib/dates";
import { sessionOn, type CalendarPlan } from "./calendar";
import type { PlanItem } from "./plan";

// Onglet « Mon plan », design « Aujourd'hui » (décision du fondateur,
// 2026-11-02) : la séance d'un jour en grand, ses éléments en cartes, puis les
// prochaines séances. Fonctions pures, testées dans plan-today.test.ts.

type Session = CalendarPlan["schedule"][number];

/** Séparateur du repas et du plat dans un menu (« Souper — Bol… »). */
const MEAL_SEPARATOR = " — ";

/**
 * Un élément de séance en trois lignes : au-dessus (séries, repas ou durée),
 * le nom, puis le reste du détail. « 4 × 8, repos 90 s » → « 4 × 8 » et
 * « Repos 90 s » ; « Souper — Saumon » → « Souper » et « Saumon ».
 */
export function itemParts(item: Pick<PlanItem, "name" | "detail">): {
  kicker: string | null;
  name: string;
  sub: string | null;
} {
  const detail = item.detail.trim();
  const meal = item.name.indexOf(MEAL_SEPARATOR);
  if (meal > 0) {
    return {
      kicker: item.name.slice(0, meal),
      name: item.name.slice(meal + MEAL_SEPARATOR.length),
      sub: detail || null,
    };
  }
  if (!detail) return { kicker: null, name: item.name, sub: null };
  const comma = detail.indexOf(", ");
  if (comma < 0) return { kicker: detail, name: item.name, sub: null };
  const rest = detail.slice(comma + 2);
  return {
    kicker: detail.slice(0, comma),
    name: item.name,
    sub: rest.charAt(0).toUpperCase() + rest.slice(1),
  };
}

/** Les prochaines séances après `day` (au plus `limit`, sur deux semaines). */
export function nextSessions(
  plan: CalendarPlan,
  day: string,
  limit = 3,
): { day: string; session: Session }[] {
  const found: { day: string; session: Session }[] = [];
  for (let offset = 1; offset <= 14 && found.length < limit; offset++) {
    const next = addDays(day, offset);
    const session = sessionOn(plan, next);
    if (session) found.push({ day: next, session });
  }
  return found;
}

/** Où se trouve un jour par rapport au plan. */
export function dayStatus(
  plan: Pick<CalendarPlan, "startsOn" | "endsOn">,
  day: string,
): "before" | "during" | "after" {
  if (day < plan.startsOn) return "before";
  return day > plan.endsOn ? "after" : "during";
}
