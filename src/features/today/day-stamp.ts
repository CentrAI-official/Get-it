/**
 * « JEU · 08 OCT » : jour de la semaine et date courte, dans le fuseau de
 * l'utilisateur, pour l'en-tête de la page Aujourd'hui.
 */
export function formatDayStamp(date: Date, locale: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    timeZone,
  }).formatToParts(date);
  // « jeu. » → « jeu »
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value.replace(/\.$/, "") ?? "";

  return `${part("weekday")} · ${part("day")} ${part("month")}`.toLocaleUpperCase(
    locale,
  );
}
