/**
 * Jours du calendrier (échéances, dates cibles) : chaînes « AAAA-MM-JJ », sans heure
 * ni fuseau. En base, colonnes `date`, que Prisma lit et écrit à minuit UTC.
 */

/** Jour du calendrier d'un instant, dans le fuseau de l'utilisateur. */
export function toCalendarDay(date: Date, timeZone: string): string {
  // La locale en-CA formate en AAAA-MM-JJ
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Valeur d'une colonne `date` → « AAAA-MM-JJ ». */
export function fromDbDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** « AAAA-MM-JJ » → valeur pour une colonne `date` (à formater avec timeZone: "UTC"). */
export function toDbDate(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

/** Jour décalé de `amount` jours (négatif pour reculer). */
export function addDays(day: string, amount: number): string {
  const date = toDbDate(day);
  date.setUTCDate(date.getUTCDate() + amount);
  return fromDbDate(date);
}

/** Jour de la semaine ISO : 1 (lundi) à 7 (dimanche). */
export function isoWeekday(day: string): number {
  return toDbDate(day).getUTCDay() || 7;
}

/** Les `count` derniers jours, du plus ancien à `today` inclus. */
export function lastDays(today: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) =>
    addDays(today, index - count + 1),
  );
}

/** Jours de `from` à `to` (négatif si `to` est avant). */
export function daysBetween(from: string, to: string): number {
  return Math.round(
    (toDbDate(to).getTime() - toDbDate(from).getTime()) / 86_400_000,
  );
}
