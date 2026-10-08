import { z } from "zod";
import { PILLARS } from "@/config/pillars";
import { routing } from "@/i18n/routing";
import { fieldErrorsFrom } from "@/lib/form-errors";

/** Erreurs affichables pour les objectifs, jalons et tâches (clés de `Goals.errors`). */
export const GOAL_ERROR_KEYS = [
  "titleRequired",
  "titleTooLong",
  "descriptionTooLong",
  "pillarRequired",
  "dateInvalid",
  "notFound",
  "unexpected",
] as const;
export type GoalErrorKey = (typeof GOAL_ERROR_KEYS)[number];

export function isGoalErrorKey(value: unknown): value is GoalErrorKey {
  return GOAL_ERROR_KEYS.includes(value as GoalErrorKey);
}

/** Doit rester aligné avec l'enum GoalStatus de prisma/schema.prisma (un test le vérifie). */
export const GOAL_STATUSES = ["active", "completed", "archived"] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];

export const GOAL_TITLE_MIN_LENGTH = 2;
export const GOAL_TITLE_MAX_LENGTH = 120;
export const GOAL_DESCRIPTION_MAX_LENGTH = 1000;
/** Titre d'un jalon ou d'une tâche. */
export const ITEM_TITLE_MAX_LENGTH = 200;

const error = (key: GoalErrorKey) => ({ error: key });

/** Jour facultatif d'un formulaire : champ vide → null, sinon « AAAA-MM-JJ » valide. */
export const optionalDaySchema = z
  .preprocess(
    (value) => (value === "" ? undefined : value),
    z.iso.date(error("dateInvalid")).optional(),
  )
  .transform((value) => value ?? null);

export const recordIdSchema = z.uuid();

export const goalFormSchema = z.object({
  locale: z.enum(routing.locales),
  title: z
    .string(error("titleRequired"))
    .trim()
    .min(GOAL_TITLE_MIN_LENGTH, error("titleRequired"))
    .max(GOAL_TITLE_MAX_LENGTH, error("titleTooLong")),
  description: z
    .string()
    .trim()
    .max(GOAL_DESCRIPTION_MAX_LENGTH, error("descriptionTooLong"))
    .optional()
    .transform((value) => value || null),
  pillar: z.enum(PILLARS, error("pillarRequired")),
  targetDate: optionalDaySchema,
});
export type GoalFormInput = z.infer<typeof goalFormSchema>;

/** Titre d'un jalon ou d'une tâche. */
export const itemTitleSchema = z
  .string(error("titleRequired"))
  .trim()
  .min(1, error("titleRequired"))
  .max(ITEM_TITLE_MAX_LENGTH, error("titleTooLong"));

export const milestoneFormSchema = z.object({ title: itemTitleSchema });

const GOAL_FIELDS = ["title", "description", "pillar", "targetDate"] as const;
export type GoalField = (typeof GOAL_FIELDS)[number];

/** État renvoyé au formulaire d'objectif (création ou modification). */
export type GoalFormState = {
  status: "idle" | "error";
  error?: GoalErrorKey;
  fieldErrors?: Partial<Record<GoalField, GoalErrorKey>>;
  /** Saisie réaffichée après une erreur (le formulaire est réinitialisé après l'envoi). */
  values?: Partial<Record<GoalField, string>>;
};

export function goalFieldErrors(error: z.ZodError) {
  return fieldErrorsFrom(error, GOAL_FIELDS, isGoalErrorKey, "unexpected");
}

/** Première erreur d'un petit formulaire (jalon, tâche). */
export function firstGoalError(error: z.ZodError): GoalErrorKey {
  const message = error.issues[0]?.message;
  return isGoalErrorKey(message) ? message : "unexpected";
}

/** État renvoyé aux petits formulaires d'ajout (jalon, tâche). */
export type ItemFormState = {
  status: "idle" | "success" | "error";
  error?: GoalErrorKey;
  values?: { title?: string; dueDate?: string };
};

export const initialItemFormState: ItemFormState = { status: "idle" };
