import { isoWeekday } from "@/lib/dates";

/**
 * Barème de l'XP (§6), validé pour le MVP. Changer une valeur ne touche que
 * l'XP gagnée ensuite ; l'XP déjà gagnée peut être recalculée par migration.
 */
export const XP_REWARDS = {
  /** Habitude faite un jour prévu. */
  habitScheduled: 10,
  /** Habitude faite un jour non prévu (bonus). */
  habitBonus: 5,
  task: 10,
  milestone: 25,
  goal: 100,
  /** Une fois par jour. */
  checkIn: 5,
  /** Une page du journal (une par jour). */
  journal: 5,
} as const;

/**
 * Tâches qui rapportent de l'XP par jour : au-delà, cocher ne rapporte plus rien
 * (créer et cocher des tâches bidon ne doit pas faire monter de niveau).
 */
export const DAILY_TASK_XP_LIMIT = 10;

/** XP d'une habitude faite ce jour-là, selon qu'il était prévu ou non. */
export function habitDayXp(weekdays: readonly number[], day: string) {
  return weekdays.includes(isoWeekday(day))
    ? XP_REWARDS.habitScheduled
    : XP_REWARDS.habitBonus;
}

/** XP à gagner pour passer du niveau `level` au suivant : 100 × niveau. */
export function xpToNextLevel(level: number) {
  return 100 * level;
}

/** XP totale nécessaire pour atteindre `level` (niveau 1 : 0 XP). */
export function totalXpForLevel(level: number) {
  return 50 * level * (level - 1);
}

export type LevelProgress = {
  level: number;
  /** XP gagnée depuis le début du niveau. */
  current: number;
  /** XP à gagner dans ce niveau pour passer au suivant. */
  needed: number;
  /** Part du niveau faite, de 0 à 1. */
  progress: number;
};

/** Niveau atteint avec `total` XP, et avancement vers le suivant. */
export function levelFromXp(total: number): LevelProgress {
  const xp = Math.max(0, Math.floor(total));
  // Plus grand niveau L tel que 50·L·(L−1) ≤ xp
  let level = Math.max(1, Math.floor((1 + Math.sqrt(1 + xp / 12.5)) / 2));
  while (totalXpForLevel(level + 1) <= xp) level += 1;
  while (level > 1 && totalXpForLevel(level) > xp) level -= 1;

  const current = xp - totalXpForLevel(level);
  const needed = xpToNextLevel(level);
  return { level, current, needed, progress: current / needed };
}
