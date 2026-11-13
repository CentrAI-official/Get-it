import { isValidTimeZone } from "@/lib/time-zone";

// Le fuseau horaire du compte (décision du fondateur, 2026-11-12) : Get iT compte
// les journées, les séries, les rappels et les séances à l'heure du compte. Il
// se change dans Réglages, et Get iT propose de le changer quand le téléphone
// n'est plus à la même heure (voyage, déménagement). Fonctions pures.

/** Les fuseaux proposés dans Réglages : le Canada, puis les États-Unis. */
export const TIME_ZONE_CHOICES = [
  "America/St_Johns",
  "America/Halifax",
  "America/Moncton",
  "America/Toronto",
  "America/Winnipeg",
  "America/Regina",
  "America/Edmonton",
  "America/Vancouver",
  "America/Whitehorse",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Phoenix",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
] as const;

/** La ville d'un fuseau (« America/St_Johns » → « St Johns »). */
export function cityOf(timeZone: string) {
  return (timeZone.split("/").at(-1) ?? timeZone).replace(/_/g, " ");
}

/** Le décalage (minutes) d'un fuseau par rapport à UTC, à cet instant. */
function offsetAt(timeZone: string, instant: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  }).formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  const shown = Date.UTC(
    read("year"),
    read("month") - 1,
    read("day"),
    read("hour") % 24,
    read("minute"),
  );
  return Math.round((shown - instant.getTime()) / 60_000);
}

/**
 * Deux fuseaux à la même heure toute l'année (« America/Montreal » et
 * « America/Toronto ») : pas la peine de proposer un changement. Comparés
 * maintenant et dans six mois, pour l'heure d'été.
 */
export function sameClock(a: string, b: string, now: Date) {
  if (a === b) return true;
  if (!isValidTimeZone(a) || !isValidTimeZone(b)) return false;
  const later = new Date(now.getTime() + 182 * 24 * 60 * 60_000);
  return (
    offsetAt(a, now) === offsetAt(b, now) &&
    offsetAt(a, later) === offsetAt(b, later)
  );
}

/** Les fuseaux d'une liste de Réglages : ceux de Get iT, et ceux du compte et du téléphone s'ils n'y sont pas. */
export function timeZoneOptions(...extra: (string | null)[]) {
  const list: string[] = [...TIME_ZONE_CHOICES];
  for (const zone of extra) {
    if (zone && isValidTimeZone(zone) && !list.includes(zone)) list.push(zone);
  }
  return list;
}
