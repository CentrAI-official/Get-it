import { addDays, toDbDate } from "@/lib/dates";
import { WEEKDAYS } from "./schemas";

// Lundi de référence : sert à nommer les jours de la semaine avec Intl
const REFERENCE_MONDAY = "2024-01-01";

/** Date (à formater avec timeZone: "UTC") d'un jour de la semaine ISO, pour obtenir son nom. */
export function weekdayDate(weekday: number): Date {
  return toDbDate(addDays(REFERENCE_MONDAY, weekday - 1));
}

/** Les jours de la semaine dans l'ordre ISO, avec leur date de référence. */
export const WEEKDAY_DATES = WEEKDAYS.map((weekday) => ({
  weekday,
  date: weekdayDate(weekday),
}));
