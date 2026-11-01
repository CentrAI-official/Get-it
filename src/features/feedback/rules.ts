import { hasLocale, type Locale } from "next-intl";
import { z } from "zod";
import { routing } from "@/i18n/routing";

// Avis des membres envoyés à l'équipe. Listes alignées sur les contraintes de
// la migration 20261110120000_feedback_errors (un test le vérifie).

/** Avis libre (Réglages › Donner mon avis). */
export const FEEDBACK_KINDS = ["idea", "problem", "praise"] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

/** Réponse à la question posée une fois, après une semaine. */
export const WEEK_KIND = "week";

/** « Qu'est-ce qui t'aide le plus? » : les grandes parties de l'application. */
export const FEEDBACK_TOPICS = [
  "community",
  "messages",
  "development",
  "goals",
  "journal",
  "coach",
  "marketplace",
  "ranked",
] as const;
export type FeedbackTopic = (typeof FEEDBACK_TOPICS)[number];

export const FEEDBACK_MAX_LENGTH = 1000;
/** Au plus 10 avis par personne et par 24 heures. */
export const FEEDBACK_DAILY_LIMIT = 10;
/** La question est posée une fois, au moins 7 jours après l'inscription. */
export const WEEK_QUESTION_AFTER_DAYS = 7;

const locale = z
  .string()
  .refine((value): value is Locale => hasLocale(routing.locales, value));

export const feedbackSchema = z.object({
  kind: z.enum(FEEDBACK_KINDS),
  body: z.string().trim().min(3).max(FEEDBACK_MAX_LENGTH),
  locale,
});

export const weekAnswerSchema = z.object({
  topic: z.enum(FEEDBACK_TOPICS),
  /** Une précision facultative. */
  body: z
    .string()
    .trim()
    .max(FEEDBACK_MAX_LENGTH)
    .transform((value) => (value === "" ? null : value)),
});

export const FEEDBACK_ERRORS = [
  "invalid",
  "limitReached",
  "unexpected",
] as const;
export type FeedbackError = (typeof FEEDBACK_ERRORS)[number];

/**
 * La question d'une semaine est-elle due ? Inscrit depuis au moins 7 jours et
 * jamais répondue ni refusée.
 */
export function isWeekQuestionDue(
  createdAt: Date,
  promptedAt: Date | null,
  now: Date,
) {
  if (promptedAt) return false;
  const days = (now.getTime() - createdAt.getTime()) / 86_400_000;
  return days >= WEEK_QUESTION_AFTER_DAYS;
}
