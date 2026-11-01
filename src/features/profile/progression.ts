import { dayStreak, mondayOf } from "@/features/streaks/rules";
import { addDays, daysBetween } from "@/lib/dates";

// Aperçu du Profil : la régularité (jours actifs) et le rythme des objectifs en
// cours. Fonctions pures, partagées par le serveur et les tests.

/** Semaines montrées au plus, et au moins (un compte récent en montre moins). */
export const REGULARITY_WEEKS = 12;
export const REGULARITY_MIN_WEEKS = 4;

export type RegularityWeek = {
  /** Lundi de la semaine, « AAAA-MM-JJ ». */
  start: string;
  /** Jours actifs de la semaine (jusqu'à aujourd'hui pour la semaine en cours). */
  count: number;
  current: boolean;
};

export type Regularity = {
  /** Du plus ancien à la semaine en cours. */
  weeks: RegularityWeek[];
  thisWeek: number;
  /** Jours actifs d'affilée jusqu'à aujourd'hui (aujourd'hui pas encore fait ne la casse pas). */
  streak: number;
  /** Plus longue série. */
  best: number;
};

/**
 * Jours actifs par semaine (lundi à dimanche), série en cours et record.
 * `activeDays` : les jours où la personne a fait au moins une action ;
 * `firstDay` : son inscription. Un compte récent montre ses semaines depuis
 * l'inscription (4 au moins, 12 au plus).
 */
export function regularity(
  activeDays: readonly string[],
  today: string,
  firstDay: string,
): Regularity {
  const active = new Set(activeDays.filter((day) => day <= today));
  const currentStart = mondayOf(today);
  const since = Math.floor(
    daysBetween(mondayOf(firstDay), currentStart) / 7 + 1,
  );
  const count = Math.min(
    REGULARITY_WEEKS,
    Math.max(REGULARITY_MIN_WEEKS, since),
  );

  const weeks = Array.from({ length: count }, (_, index) => {
    const start = addDays(currentStart, (index - count + 1) * 7);
    let days = 0;
    for (let offset = 0; offset < 7; offset++) {
      if (active.has(addDays(start, offset))) days++;
    }
    return { start, count: days, current: index === count - 1 };
  });

  const { current, best } = dayStreak([...active], today);
  return { weeks, thisWeek: weeks.at(-1)?.count ?? 0, streak: current, best };
}

export const GOAL_PACES = ["onTrack", "slightlyLate", "late"] as const;
export type GoalPaceStatus = (typeof GOAL_PACES)[number];

/** Écart toléré avant « En retard » (un peu en retard jusqu'à 15 points). */
const SLIGHTLY_LATE = 0.15;

export type GoalPace = {
  /** Part des jalons faits, de 0 à 1 ; null sans jalon. */
  progress: number | null;
  /** Part du temps écoulé entre le début et la date visée ; null sans date. */
  elapsed: number | null;
  /** Jours avant la date visée (négatif si elle est passée) ; null sans date. */
  daysLeft: number | null;
  /** Null sans jalon ou sans date : rien à comparer. */
  status: GoalPaceStatus | null;
};

/**
 * Où en est un objectif par rapport au temps écoulé : les jalons faits
 * comparés au chemin parcouru entre le jour de sa création et la date visée.
 */
export function goalPace(goal: {
  milestonesDone: number;
  milestonesTotal: number;
  /** Jour de création, dans le fuseau de la personne. */
  startedOn: string;
  targetDate: string | null;
  today: string;
}): GoalPace {
  const progress =
    goal.milestonesTotal > 0
      ? goal.milestonesDone / goal.milestonesTotal
      : null;
  if (!goal.targetDate) {
    return { progress, elapsed: null, daysLeft: null, status: null };
  }

  const daysLeft = daysBetween(goal.today, goal.targetDate);
  const span = daysBetween(goal.startedOn, goal.targetDate);
  const elapsed =
    span <= 0
      ? 1
      : Math.min(
          1,
          Math.max(0, daysBetween(goal.startedOn, goal.today) / span),
        );
  if (progress === null) return { progress, elapsed, daysLeft, status: null };

  const gap = progress - elapsed;
  const status: GoalPaceStatus =
    progress >= 1 || gap >= 0
      ? "onTrack"
      : daysLeft >= 0 && gap > -SLIGHTLY_LATE
        ? "slightlyLate"
        : "late";
  return { progress, elapsed, daysLeft, status };
}
