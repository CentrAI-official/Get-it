import { PILLARS, type Pillar } from "@/config/pillars";
import { isoWeekday } from "@/lib/dates";

type PlannedHabit = { weekdays: readonly number[]; archived: boolean };

/** Habitudes prévues ce jour-là, hors pause. */
export function selectHabitsToday<H extends PlannedHabit>(
  habits: readonly H[],
  today: string,
): H[] {
  const weekday = isoWeekday(today);
  return habits.filter(
    (habit) => !habit.archived && habit.weekdays.includes(weekday),
  );
}

export type Progress = { done: number; total: number };

type CountedQuest = {
  /** Null pour une tâche sans objectif : elle compte dans le total seulement. */
  pillar: Pillar | null;
  done: boolean;
  /** Tâche due avant aujourd'hui : affichée, sans gonfler le total. */
  late: boolean;
};

/**
 * Avancement de la journée, au total et par pilier : habitudes prévues et
 * tâches dues aujourd'hui. Les tâches en retard sont affichées à part.
 */
export function summarizeDay(quests: readonly CountedQuest[]): {
  day: Progress;
  pillars: Record<Pillar, Progress>;
} {
  const day = { done: 0, total: 0 };
  const pillars = Object.fromEntries(
    PILLARS.map((pillar) => [pillar, { done: 0, total: 0 }]),
  ) as Record<Pillar, Progress>;

  for (const quest of quests) {
    if (quest.late) continue;
    const add = quest.done ? 1 : 0;
    day.total += 1;
    day.done += add;
    if (quest.pillar) {
      pillars[quest.pillar].total += 1;
      pillars[quest.pillar].done += add;
    }
  }
  return { day, pillars };
}

/** Part faite, de 0 à 1 (0 quand rien n'est prévu). */
export function ratio({ done, total }: Progress) {
  return total === 0 ? 0 : done / total;
}
