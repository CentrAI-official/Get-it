import { z } from "zod";
import { DAY_MOMENTS } from "@/config/moments";
import { PILLARS } from "@/config/pillars";
import { routing } from "@/i18n/routing";
import { fieldErrorsFrom } from "@/lib/form-errors";

/** Erreurs affichables pour les habitudes (clés de `Habits.errors`). */
export const HABIT_ERROR_KEYS = [
  "titleRequired",
  "titleTooLong",
  "pillarRequired",
  "weekdaysRequired",
  "notFound",
  "unexpected",
] as const;
export type HabitErrorKey = (typeof HABIT_ERROR_KEYS)[number];

export function isHabitErrorKey(value: unknown): value is HabitErrorKey {
  return HABIT_ERROR_KEYS.includes(value as HabitErrorKey);
}

/** Jours de la semaine ISO, du lundi (1) au dimanche (7). */
export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;
/** Lundi à vendredi. */
export const WORKWEEK = [1, 2, 3, 4, 5] as const;
/** Combien de jours on peut rattraper : aujourd'hui et les 6 précédents. */
export const EDITABLE_DAYS = 7;
export const HABIT_TITLE_MAX_LENGTH = 120;

const error = (key: HabitErrorKey) => ({ error: key });

/** « 1,3,5 » (champ caché du formulaire) → [1, 3, 5], triés et sans doublons. */
const weekdaysSchema = z
  .string(error("weekdaysRequired"))
  .transform((value) =>
    [...new Set(value.split(",").filter(Boolean).map(Number))].sort(
      (a, b) => a - b,
    ),
  )
  .pipe(
    z
      .array(
        z
          .int(error("weekdaysRequired"))
          .min(1, error("weekdaysRequired"))
          .max(7, error("weekdaysRequired")),
        error("weekdaysRequired"),
      )
      .min(1, error("weekdaysRequired")),
  );

export const habitFormSchema = z.object({
  locale: z.enum(routing.locales),
  title: z
    .string(error("titleRequired"))
    .trim()
    .min(1, error("titleRequired"))
    .max(HABIT_TITLE_MAX_LENGTH, error("titleTooLong")),
  pillar: z.enum(PILLARS, error("pillarRequired")),
  weekdays: weekdaysSchema,
  /** Moment de la journée, facultatif : champ vide → null (dans la journée). */
  moment: z
    .preprocess(
      (value) => (value === "" || value === undefined ? null : value),
      z.enum(DAY_MOMENTS).nullable(),
    )
    .catch(null),
  /** Objectif lié, facultatif : champ vide → null. */
  goalId: z
    .preprocess(
      (value) => (value === "" ? undefined : value),
      z.uuid().optional(),
    )
    .transform((value) => value ?? null),
});
export type HabitFormInput = z.infer<typeof habitFormSchema>;

const HABIT_FIELDS = ["title", "pillar", "weekdays", "goalId"] as const;
export type HabitField = (typeof HABIT_FIELDS)[number];

export function habitFieldErrors(error: z.ZodError) {
  return fieldErrorsFrom(error, HABIT_FIELDS, isHabitErrorKey, "unexpected");
}

/** État renvoyé au formulaire d'habitude (création ou modification). */
export type HabitFormState = {
  status: "idle" | "error";
  error?: HabitErrorKey;
  fieldErrors?: Partial<Record<HabitField, HabitErrorKey>>;
  /** Saisie réaffichée après une erreur (le formulaire est réinitialisé après l'envoi). */
  values?: Partial<Record<HabitField, string>>;
};

/** Type de calendrier, pour l'afficher simplement (« Tous les jours », « En semaine »…). */
export function describeSchedule(
  weekdays: readonly number[],
): "daily" | "workweek" | "weekend" | "custom" {
  const key = [...weekdays].sort((a, b) => a - b).join();
  if (key === WEEKDAYS.join()) return "daily";
  if (key === WORKWEEK.join()) return "workweek";
  if (key === "6,7") return "weekend";
  return "custom";
}
