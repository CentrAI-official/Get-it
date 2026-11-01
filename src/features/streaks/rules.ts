import { addDays, daysBetween, isoWeekday } from "@/lib/dates";

// Les séries remplacent l'XP : un jour est « actif » dès qu'une action y est
// faite (habitude, tâche, jalon, objectif, check-in, page de journal).
// Fonctions pures, partagées par le serveur, « Ma journée » et les tests.

/** Paliers de série fêtés (et partageables) : 7, 30, 100 et 365 jours. */
export const STREAK_MILESTONES = [7, 30, 100, 365] as const;

/** Série la plus courte qu'on peut partager dans le Centre. */
export const MIN_SHARED_DAY_STREAK = 3;

export type StreakCount = {
  /** Série en cours. */
  current: number;
  /** Plus longue série. */
  best: number;
};

/** Lundi de la semaine d'un jour (« AAAA-MM-JJ »). */
export function mondayOf(day: string) {
  return addDays(day, 1 - isoWeekday(day));
}

/** Jours actifs d'affilée qui finissent la veille de `today` (aujourd'hui exclu). */
export function streakBefore(activeDays: Iterable<string>, today: string) {
  const active = new Set(activeDays);
  let count = 0;
  let day = addDays(today, -1);
  while (active.has(day)) {
    count++;
    day = addDays(day, -1);
  }
  return count;
}

/**
 * Série de jours actifs et record. Aujourd'hui pas encore actif ne casse pas
 * la série : elle tient jusqu'à minuit.
 */
export function dayStreak(
  activeDays: readonly string[],
  today: string,
): StreakCount {
  const active = new Set(activeDays.filter((day) => day <= today));
  const current = streakBefore(active, today) + (active.has(today) ? 1 : 0);
  return { current, best: Math.max(current, longestRun(active, 1)) };
}

/**
 * Semaines d'affilée (lundi à dimanche) avec au moins un jour actif, et record.
 * La semaine en cours pas encore active ne casse pas la série.
 */
export function weekStreak(
  activeDays: readonly string[],
  today: string,
): StreakCount {
  const weeks = new Set(
    activeDays.filter((day) => day <= today).map((day) => mondayOf(day)),
  );
  const thisWeek = mondayOf(today);
  let current = weeks.has(thisWeek) ? 1 : 0;
  let week = addDays(thisWeek, -7);
  while (weeks.has(week)) {
    current++;
    week = addDays(week, -7);
  }
  return { current, best: Math.max(current, longestRun(weeks, 7)) };
}

/** Plus longue suite de jours (ou de lundis, `step` = 7) qui se suivent. */
function longestRun(days: ReadonlySet<string>, step: number) {
  let best = 0;
  let run = 0;
  let previous: string | null = null;
  for (const day of [...days].sort()) {
    run = previous && daysBetween(previous, day) === step ? run + 1 : 1;
    best = Math.max(best, run);
    previous = day;
  }
  return best;
}

/** Palier franchi en passant de `before` à `after` jours de série, sinon null. */
export function streakMilestone(before: number, after: number) {
  return (
    STREAK_MILESTONES.find(
      (milestone) => before < milestone && after >= milestone,
    ) ?? null
  );
}
