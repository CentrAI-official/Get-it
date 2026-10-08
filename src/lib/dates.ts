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
