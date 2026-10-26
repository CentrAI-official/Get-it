import type { Pillar } from "@/config/pillars";

// Filtre et tri de la liste des habitudes (Profil › Habitudes). Fonctions
// pures : la liste arrive du serveur dans l'ordre de création.

export const HABIT_SORTS = ["oldest", "newest"] as const;
export type HabitSort = (typeof HABIT_SORTS)[number];
export type HabitPillarFilter = Pillar | "all";

type Arrangeable = { pillar: Pillar; startDay: string };

/** Habitudes du pilier choisi, des plus anciennes aux plus récentes ou l'inverse. */
export function arrangeHabits<T extends Arrangeable>(
  habits: T[],
  pillar: HabitPillarFilter,
  sort: HabitSort,
): T[] {
  const kept = habits
    .map((habit, index) => ({ habit, index }))
    .filter(({ habit }) => pillar === "all" || habit.pillar === pillar)
    // Même jour de création : l'ordre reçu du serveur départage
    .sort(
      (a, b) =>
        a.habit.startDay.localeCompare(b.habit.startDay) || a.index - b.index,
    )
    .map(({ habit }) => habit);
  return sort === "newest" ? kept.reverse() : kept;
}

/** Nombre d'habitudes par pilier (les piliers sans habitude sont absents). */
export function countByPillar(habits: Arrangeable[]) {
  const counts = new Map<Pillar, number>();
  for (const habit of habits) {
    counts.set(habit.pillar, (counts.get(habit.pillar) ?? 0) + 1);
  }
  return counts;
}
