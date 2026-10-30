import { z } from "zod";
import type { DayMoment } from "@/config/moments";
import { routing } from "@/i18n/routing";
import { daysBetween, isoWeekday, parseClock } from "@/lib/dates";
import { fieldErrorsFrom } from "@/lib/form-errors";

// Calendrier personnel : les événements de la personne (job, souper, cuisiner
// les lunchs…), privés et sans XP. Limites alignées sur la contrainte de la
// migration 20261103120000_calendar_events (un test le vérifie). Fonctions pures.

/** Doit rester aligné avec l'enum EventRepeat de prisma/schema.prisma. */
export const EVENT_REPEATS = [
  "none",
  "daily",
  "every_two_days",
  "weekdays",
  "weekends",
  "weekly",
  "monthly",
] as const;
export type EventRepeat = (typeof EVENT_REPEATS)[number];

export const EVENT_TITLE_MAX = 120;
export const EVENT_LOCATION_MAX = 120;
/** Un événement finit au plus 14 jours après son début. */
export const EVENT_MAX_DAYS = 14;
/** Événements gardés au plus par personne. */
export const MAX_EVENTS = 500;

/** Erreurs affichables (clés de `Events.errors`). */
export const EVENT_ERRORS = [
  "titleRequired",
  "titleTooLong",
  "locationTooLong",
  "dateInvalid",
  "endBeforeStart",
  "tooLong",
  "eventLimit",
  "notFound",
  "unexpected",
] as const;
export type EventError = (typeof EVENT_ERRORS)[number];

export function isEventError(value: unknown): value is EventError {
  return EVENT_ERRORS.includes(value as EventError);
}

/** Un événement, tel que le lit le calendrier. */
export type CalendarEvent = {
  id: string;
  title: string;
  location: string | null;
  /** Premier jour, « AAAA-MM-JJ ». */
  startsOn: string;
  /** Minutes depuis minuit (0 à 1439). */
  startMinute: number;
  endsOn: string;
  endMinute: number;
  repeat: EventRepeat;
};

const error = (key: EventError) => ({ error: key });
const clockSchema = z
  .string(error("dateInvalid"))
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, error("dateInvalid"));

const EVENT_FIELDS = [
  "title",
  "location",
  "startDate",
  "startTime",
  "endDate",
  "endTime",
  "repeat",
] as const;
export type EventField = (typeof EVENT_FIELDS)[number];

/** Formulaire « Ajouter un événement », revalidé par le serveur. */
export const eventFormSchema = z
  .object({
    locale: z.enum(routing.locales),
    title: z
      .string(error("titleRequired"))
      .trim()
      .min(1, error("titleRequired"))
      .max(EVENT_TITLE_MAX, error("titleTooLong")),
    location: z
      .string()
      .trim()
      .max(EVENT_LOCATION_MAX, error("locationTooLong"))
      .optional()
      .transform((value) => value || null),
    startDate: z.iso.date(error("dateInvalid")),
    startTime: clockSchema,
    endDate: z.iso.date(error("dateInvalid")),
    endTime: clockSchema,
    repeat: z.enum(EVENT_REPEATS, error("dateInvalid")),
  })
  .superRefine((input, context) => {
    const days = daysBetween(input.startDate, input.endDate);
    const start = parseClock(input.startTime) ?? 0;
    const end = parseClock(input.endTime) ?? 0;
    if (days < 0 || (days === 0 && end <= start)) {
      context.addIssue({
        code: "custom",
        path: ["endTime"],
        message: "endBeforeStart",
      });
    } else if (days > EVENT_MAX_DAYS) {
      context.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "tooLong",
      });
    }
  })
  .transform((input) => ({
    locale: input.locale,
    title: input.title,
    location: input.location,
    startsOn: input.startDate,
    startMinute: parseClock(input.startTime) ?? 0,
    endsOn: input.endDate,
    endMinute: parseClock(input.endTime) ?? 0,
    repeat: input.repeat,
  }));
export type EventInput = z.output<typeof eventFormSchema>;

export function eventFieldErrors(error: z.ZodError) {
  return fieldErrorsFrom(error, EVENT_FIELDS, isEventError, "unexpected");
}

/** Vrai si l'événement commence ce jour-là (lui ou l'une de ses répétitions). */
export function occursOn(
  event: Pick<CalendarEvent, "startsOn" | "repeat">,
  day: string,
): boolean {
  if (day < event.startsOn) return false;
  switch (event.repeat) {
    case "none":
      return day === event.startsOn;
    case "daily":
      return true;
    case "every_two_days":
      return daysBetween(event.startsOn, day) % 2 === 0;
    case "weekdays":
      return isoWeekday(day) <= 5;
    case "weekends":
      return isoWeekday(day) >= 6;
    case "weekly":
      return isoWeekday(day) === isoWeekday(event.startsOn);
    case "monthly":
      // Le même jour du mois ; les mois trop courts sont sautés (ex. le 31)
      return day.slice(8) === event.startsOn.slice(8);
  }
}

/** Nombre de jours entre le début et la fin d'un événement (0 : le même jour). */
export function eventSpan(event: Pick<CalendarEvent, "startsOn" | "endsOn">) {
  return daysBetween(event.startsOn, event.endsOn);
}

/**
 * Moment de la journée d'un événement, d'après son heure de début : le matin
 * avant midi, le midi jusqu'à 14 h, le soir ensuite.
 */
export function eventMoment(startMinute: number): DayMoment {
  if (startMinute < 12 * 60) return "morning";
  if (startMinute < 14 * 60) return "noon";
  return "evening";
}
