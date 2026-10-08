import { addDays, isoWeekday } from "@/lib/dates";

type StreakInput = {
  /** Jours prévus, de 1 (lundi) à 7 (dimanche). */
  weekdays: readonly number[];
  /** Jours faits, « AAAA-MM-JJ ». */
  completions: ReadonlySet<string>;
  /** Premier jour suivi : la création de l'habitude, dans le fuseau de l'utilisateur. */
  startDay: string;
  /** Aujourd'hui, dans le fuseau de l'utilisateur. */
  today: string;
};

/**
 * Série actuelle et meilleure série d'une habitude.
 * - Un jour prévu et fait prolonge la série ; un jour prévu et manqué la remet à zéro.
 * - Un jour non prévu ne la casse pas ; s'il est fait quand même, il compte en bonus.
 * - Aujourd'hui, tant qu'il n'est pas fait, ne casse pas la série : la journée n'est pas finie.
 */
export function computeStreaks({
  weekdays,
  completions,
  startDay,
  today,
}: StreakInput): { current: number; best: number } {
  // Par sécurité, on remonte aussi jusqu'au plus ancien jour fait
  let first = startDay;
  for (const day of completions) if (day < first) first = day;

  let current = 0;
  let best = 0;
  for (let day = first; day <= today; day = addDays(day, 1)) {
    if (completions.has(day)) {
      current += 1;
      best = Math.max(best, current);
    } else if (day !== today && weekdays.includes(isoWeekday(day))) {
      current = 0;
    }
  }
  return { current, best };
}
