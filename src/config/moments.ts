import { Moon, Sun, Sunrise, type LucideIcon } from "lucide-react";

/**
 * Moments de la journée d'une habitude, d'une tâche ou d'une séance de plan
 * (calendrier « Semaine »). L'ordre est celui de l'affichage ; sans moment,
 * l'élément est « dans la journée ».
 */
export const DAY_MOMENTS = ["morning", "noon", "evening"] as const;

export type DayMoment = (typeof DAY_MOMENTS)[number];

export const momentIcons: Record<DayMoment, LucideIcon> = {
  morning: Sunrise,
  noon: Sun,
  evening: Moon,
};

/** Moment valide, ou null pour toute autre valeur. */
export function asDayMoment(value: unknown): DayMoment | null {
  return DAY_MOMENTS.includes(value as DayMoment) ? (value as DayMoment) : null;
}
