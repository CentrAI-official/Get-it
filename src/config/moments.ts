import { Moon, Sun, Sunrise, type LucideIcon } from "lucide-react";
import { z } from "zod";

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

/**
 * Heure d'une habitude, d'une tâche, d'une séance ou d'un événement : minutes
 * depuis minuit (0 à 1439), dans le fuseau de la personne.
 */
export const minuteOfDaySchema = z.number().int().min(0).max(1439);

/**
 * Moment de la journée d'une heure : le matin avant midi, le midi jusqu'à
 * 14 h, le soir ensuite. Un élément qui a une heure est rangé ainsi.
 */
export function momentOfMinute(minute: number): DayMoment {
  if (minute < 12 * 60) return "morning";
  if (minute < 14 * 60) return "noon";
  return "evening";
}
