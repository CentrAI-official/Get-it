import { PILLARS, type Pillar } from "@/config/pillars";
import { addDays, isoWeekday, lastDays } from "@/lib/dates";

/** Jours complets pris en compte pour la régularité : la semaine avant aujourd'hui. */
export const SCORE_WINDOW_DAYS = 7;

/** Part de l'autoévaluation dans le score ; le reste vient de la régularité. */
const ASSESSMENT_WEIGHT = 0.4;

type ScoredHabit = {
  pillar: Pillar;
  weekdays: readonly number[];
  archived: boolean;
  startDay: string;
  completions: readonly string[];
};
type ScoredTask = { pillar: Pillar; dueDate: string; done: boolean };
type Assessment = { pillar: Pillar; score: number };

/** Premier et dernier jour de la fenêtre de régularité (aujourd'hui exclu). */
export function scoreWindow(today: string) {
  return { from: addDays(today, -SCORE_WINDOW_DAYS), to: addDays(today, -1) };
}

/**
 * Score de chaque pilier, de 0 à 100, à partir de mesures réelles (§9) :
 * - l'autoévaluation la plus récente, sur 5 ;
 * - la régularité des 7 derniers jours complets : habitudes prévues faites et
 *   tâches d'objectifs dues dans la période terminées.
 * Les deux se combinent à 40/60. Sans activité prévue, l'autoévaluation seule ;
 * sans autoévaluation, la régularité seule ; sans rien, null.
 */
export function computePillarScores({
  habits,
  tasks,
  assessments,
  today,
}: {
  habits: readonly ScoredHabit[];
  tasks: readonly ScoredTask[];
  assessments: readonly Assessment[];
  today: string;
}): Record<Pillar, number | null> {
  const { from, to } = scoreWindow(today);
  const days = lastDays(to, SCORE_WINDOW_DAYS);

  return Object.fromEntries(
    PILLARS.map((pillar) => {
      let planned = 0;
      let done = 0;

      for (const habit of habits) {
        if (habit.pillar !== pillar || habit.archived) continue;
        const completions = new Set(habit.completions);
        for (const day of days) {
          if (day < habit.startDay) continue;
          if (!habit.weekdays.includes(isoWeekday(day))) continue;
          planned += 1;
          if (completions.has(day)) done += 1;
        }
      }
      for (const task of tasks) {
        if (task.pillar !== pillar) continue;
        if (task.dueDate < from || task.dueDate > to) continue;
        planned += 1;
        if (task.done) done += 1;
      }

      const assessment = assessments.find((item) => item.pillar === pillar);
      const self = assessment ? assessment.score / 5 : null;
      const regularity = planned > 0 ? done / planned : null;

      const score =
        self !== null && regularity !== null
          ? ASSESSMENT_WEIGHT * self + (1 - ASSESSMENT_WEIGHT) * regularity
          : (self ?? regularity);
      return [pillar, score === null ? null : Math.round(score * 100)];
    }),
  ) as Record<Pillar, number | null>;
}
