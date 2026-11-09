import { z } from "zod";
import { PILLARS, type Pillar } from "@/config/pillars";
import { IN_PERSON_REGIONS } from "@/features/marketplace/rules";
import { routing } from "@/i18n/routing";
import { addDays, daysBetween, isoWeekday, parseClock } from "@/lib/dates";
import { fieldErrorsFrom } from "@/lib/form-errors";

// Événements de la Communauté (décision du fondateur, 2026-11-08) : un membre
// du Centre propose une rencontre, en personne ou en ligne ; les autres disent
// « J'y vais » ou « Intéressé ». Limites alignées sur la migration
// 20261125120000_community_events (un test le vérifie). Fonctions pures.

export const COMMUNITY_EVENT_LIMITS = {
  titleMin: 3,
  titleMax: 100,
  description: 2000,
  location: 200,
  url: 300,
  capacityMin: 2,
  capacityMax: 10_000,
  /** Un événement dure 14 jours au plus. */
  maxDays: 14,
  /** On le prévoit au plus un an d'avance. */
  aheadDays: 366,
  /** Événements créés par personne en 24 h. */
  perDay: 5,
  /** Événements à venir qu'une personne organise en même temps. */
  upcoming: 20,
  /** Événements montrés par page de l'annuaire. */
  page: 30,
  /** Un message de la discussion. */
  comment: 1000,
  /** Messages de discussion par personne en 24 h. */
  commentsPerDay: 50,
  /** Messages montrés sous un événement (les plus récents). */
  commentsShown: 100,
  /** Le rappel part aux inscrits ce nombre d'heures avant le début. */
  reminderHours: 24,
  /** Événements traités par passage de la tâche planifiée. */
  remindersPerRun: 200,
  /** Événements à venir montrés sur une page pro ou dans un groupe. */
  shownOnPage: 3,
} as const;

export const EVENT_FORMATS = ["in_person", "online"] as const;
export type EventFormat = (typeof EVENT_FORMATS)[number];

export const EVENT_ATTENDANCE = ["going", "interested"] as const;
export type EventAttendanceStatus = (typeof EVENT_ATTENDANCE)[number];

/** Les filtres de l'annuaire : quand, où, sujet, et seulement les miens. */
export const EVENT_WHEN = ["all", "week", "weekend", "month"] as const;
export type EventWhen = (typeof EVENT_WHEN)[number];
export const EVENT_WHERE = ["all", "near", "online"] as const;
export type EventWhere = (typeof EVENT_WHERE)[number];

export const COMMUNITY_EVENT_ERRORS = [
  "titleRequired",
  "titleTooLong",
  "descriptionTooLong",
  "locationRequired",
  "locationTooLong",
  "urlInvalid",
  "dateInvalid",
  "inPast",
  "tooFar",
  "endBeforeStart",
  "tooLong",
  "capacityInvalid",
  "eventLimit",
  "upcomingLimit",
  "full",
  "cancelled",
  "ended",
  "notMember",
  "suspended",
  "coverInvalid",
  "commentRequired",
  "commentTooLong",
  "commentLimit",
  "groupJoinRequired",
  "notAsPage",
  "notFound",
  "unexpected",
] as const;
export type CommunityEventError = (typeof COMMUNITY_EVENT_ERRORS)[number];

const isEventError = (value: unknown): value is CommunityEventError =>
  COMMUNITY_EVENT_ERRORS.includes(value as CommunityEventError);

const error = (key: CommunityEventError) => ({ error: key });
const emptyAsMissing = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;
const clockSchema = z
  .string(error("dateInvalid"))
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, error("dateInvalid"));

const FIELDS = [
  "title",
  "description",
  "topic",
  "format",
  "location",
  "region",
  "onlineUrl",
  "startDate",
  "startTime",
  "endDate",
  "endTime",
  "capacity",
] as const;
export type CommunityEventField = (typeof FIELDS)[number];

/**
 * Formulaire « Créer un événement », revalidé par le serveur. `today` : le jour
 * de l'hôte dans son fuseau (pas d'événement dans le passé, un an d'avance au
 * plus) ; les heures sont celles de son fuseau.
 */
export function communityEventFormSchema(today: string) {
  return z
    .object({
      locale: z.enum(routing.locales),
      title: z
        .string(error("titleRequired"))
        .trim()
        .min(COMMUNITY_EVENT_LIMITS.titleMin, error("titleRequired"))
        .max(COMMUNITY_EVENT_LIMITS.titleMax, error("titleTooLong")),
      description: z
        .string()
        .trim()
        .max(COMMUNITY_EVENT_LIMITS.description, error("descriptionTooLong"))
        .optional()
        .transform((value) => value ?? ""),
      topic: z.preprocess(
        emptyAsMissing,
        z
          .enum(PILLARS)
          .optional()
          .transform((value): Pillar | null => value ?? null),
      ),
      format: z.enum(EVENT_FORMATS, error("locationRequired")),
      location: z.preprocess(
        emptyAsMissing,
        z
          .string()
          .trim()
          .max(COMMUNITY_EVENT_LIMITS.location, error("locationTooLong"))
          .optional(),
      ),
      region: z.preprocess(
        emptyAsMissing,
        z.enum(IN_PERSON_REGIONS).optional(),
      ),
      onlineUrl: z.preprocess(
        emptyAsMissing,
        z
          .url({ protocol: /^https$/, error: "urlInvalid" })
          .max(COMMUNITY_EVENT_LIMITS.url, error("urlInvalid"))
          .optional(),
      ),
      startDate: z.iso.date(error("dateInvalid")),
      startTime: clockSchema,
      endDate: z.preprocess(
        emptyAsMissing,
        z.iso.date(error("dateInvalid")).optional(),
      ),
      endTime: z.preprocess(emptyAsMissing, clockSchema.optional()),
      capacity: z.preprocess(
        emptyAsMissing,
        z.coerce
          .number(error("capacityInvalid"))
          .int(error("capacityInvalid"))
          .min(COMMUNITY_EVENT_LIMITS.capacityMin, error("capacityInvalid"))
          .max(COMMUNITY_EVENT_LIMITS.capacityMax, error("capacityInvalid"))
          .optional(),
      ),
    })
    .superRefine((input, context) => {
      const issue = (path: CommunityEventField, message: CommunityEventError) =>
        context.addIssue({ code: "custom", path: [path], message });
      if (input.format === "in_person" && !input.location) {
        issue("location", "locationRequired");
      }
      if (input.format === "online" && !input.onlineUrl) {
        issue("onlineUrl", "urlInvalid");
      }
      if (input.startDate < today) issue("startDate", "inPast");
      else if (
        daysBetween(today, input.startDate) > COMMUNITY_EVENT_LIMITS.aheadDays
      ) {
        issue("startDate", "tooFar");
      }
      // La fin est facultative ; si elle est là, elle suit le début
      if (input.endDate || input.endTime) {
        const endDate = input.endDate ?? input.startDate;
        const start = parseClock(input.startTime) ?? 0;
        const end = parseClock(input.endTime ?? "") ?? null;
        if (end === null) return issue("endTime", "dateInvalid");
        const days = daysBetween(input.startDate, endDate);
        if (days < 0 || (days === 0 && end <= start)) {
          issue("endTime", "endBeforeStart");
        } else if (
          days > COMMUNITY_EVENT_LIMITS.maxDays ||
          (days === COMMUNITY_EVENT_LIMITS.maxDays && end > start)
        ) {
          issue("endDate", "tooLong");
        }
      }
    })
    .transform((input) => ({
      locale: input.locale,
      title: input.title,
      description: input.description,
      topic: input.topic,
      format: input.format,
      // Seulement ce qui va avec le format choisi
      location: input.format === "in_person" ? (input.location ?? null) : null,
      region: input.format === "in_person" ? (input.region ?? null) : null,
      onlineUrl: input.format === "online" ? (input.onlineUrl ?? null) : null,
      startDay: input.startDate,
      startMinute: parseClock(input.startTime) ?? 0,
      endDay:
        input.endTime !== undefined ? (input.endDate ?? input.startDate) : null,
      endMinute:
        input.endTime !== undefined ? (parseClock(input.endTime) ?? 0) : null,
      capacity: input.capacity ?? null,
    }));
}
export type CommunityEventInput = z.output<
  ReturnType<typeof communityEventFormSchema>
>;

export function communityEventFieldErrors(error: z.ZodError) {
  return fieldErrorsFrom(error, FIELDS, isEventError, "unexpected");
}

/** Un message de la discussion, revalidé par le serveur. */
export const eventCommentSchema = z
  .string(error("commentRequired"))
  .trim()
  .min(1, error("commentRequired"))
  .max(COMMUNITY_EVENT_LIMITS.comment, error("commentTooLong"));

/**
 * Le rappel est dû : l'événement commence dans les prochaines 24 heures. Un
 * événement créé ou déplacé à moins de 24 h de son début n'en reçoit pas (les
 * inscrits viennent de le voir) : voir `needsReminder`.
 */
export function reminderDue(startsAt: Date, now: Date) {
  const ms = startsAt.getTime() - now.getTime();
  return ms > 0 && ms <= COMMUNITY_EVENT_LIMITS.reminderHours * 3_600_000;
}

/** Un rappel restera à envoyer : le début est à plus de 24 heures. */
export function needsReminder(startsAt: Date, now: Date) {
  return (
    startsAt.getTime() - now.getTime() >
    COMMUNITY_EVENT_LIMITS.reminderHours * 3_600_000
  );
}

export type EventFilters = {
  when: EventWhen;
  where: EventWhere;
  topic: Pillar | null;
  /** Seulement ceux que j'organise ou où je vais. */
  mine: boolean;
};

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

/** Filtres lus dans l'adresse (valeurs inconnues ignorées). */
export function parseEventFilters(
  params: Record<string, string | string[] | undefined>,
): EventFilters {
  const pick = <T extends string>(list: readonly T[], value: unknown) =>
    list.find((entry) => entry === value);
  return {
    when: pick(EVENT_WHEN, first(params.quand)) ?? "all",
    where: pick(EVENT_WHERE, first(params.ou)) ?? "all",
    topic: pick(PILLARS, first(params.sujet)) ?? null,
    mine: first(params.vue) === "miens",
  };
}

/**
 * Jours couverts par « Quand », de `from` à `to` inclus (null : sans limite) :
 * les 7 prochains jours, la fin de semaine qui vient (ou en cours), ou les 30
 * prochains jours.
 */
export function whenRange(
  when: EventWhen,
  today: string,
): { from: string; to: string | null } {
  switch (when) {
    case "all":
      return { from: today, to: null };
    case "week":
      return { from: today, to: addDays(today, 6) };
    case "month":
      return { from: today, to: addDays(today, 29) };
    case "weekend": {
      const weekday = isoWeekday(today);
      // Samedi et dimanche ; le dimanche, seulement aujourd'hui
      if (weekday === 7) return { from: today, to: today };
      const saturday = addDays(today, 6 - weekday);
      return {
        from: weekday === 6 ? today : saturday,
        to: addDays(saturday, 1),
      };
    }
  }
}

/** Places qui restent (null : sans limite). */
export function spotsLeft(capacity: number | null, going: number) {
  return capacity === null ? null : Math.max(0, capacity - going);
}

/** Un lien d'événement en ligne sûr à montrer (https seulement). */
export function safeUrl(url: string | null) {
  return url && /^https:\/\//i.test(url) ? url : null;
}
