import { z } from "zod";
import { HABIT_TITLE_MAX_LENGTH, WEEKDAYS } from "@/features/habits/schemas";
import { ITEM_TITLE_MAX_LENGTH } from "./schemas";

/** Taille d'un plan proposé par Get iT AI (§8) : assez pour démarrer, pas plus. */
export const PLAN_LIMITS = {
  milestones: 6,
  tasks: 6,
  habits: 3,
  /** Les premières tâches tombent dans les 60 prochains jours au plus. */
  horizonDays: 60,
} as const;

/**
 * Sortie structurée demandée au modèle. Volontairement simple (pas de bornes) :
 * les limites sont appliquées ensuite par `normalizeGoalPlan`.
 */
export const aiGoalPlanSchema = z.object({
  summary: z.string(),
  milestones: z.array(z.object({ title: z.string() })),
  tasks: z.array(z.object({ title: z.string(), dueInDays: z.number().int() })),
  habits: z.array(
    z.object({ title: z.string(), weekdays: z.array(z.number().int()) }),
  ),
});

export type AiGoalPlan = z.infer<typeof aiGoalPlanSchema>;

export type GoalPlan = {
  summary: string;
  milestones: { title: string }[];
  /** `dueInDays` : échéance en jours à partir d'aujourd'hui. */
  tasks: { title: string; dueInDays: number }[];
  /** `weekdays` : 1 (lundi) à 7 (dimanche). */
  habits: { title: string; weekdays: number[] }[];
};

const clean = (text: string, max: number) =>
  text.replace(/\s+/g, " ").trim().slice(0, max).trim();

/** Garde les titres non vides et sans doublon (insensible à la casse), dans la limite. */
function uniqueByTitle<T extends { title: string }>(
  items: T[],
  limit: number,
): T[] {
  const seen = new Set<string>();
  return items
    .filter((item) => {
      const key = item.title.toLocaleLowerCase();
      if (!item.title || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

/**
 * Plan prêt à afficher : titres nettoyés et raccourcis, doublons retirés,
 * nombres d'éléments plafonnés, échéances bornées (jamais après la date
 * cible de l'objectif), jours de la semaine valides (tous les jours par défaut).
 */
export function normalizeGoalPlan(
  raw: AiGoalPlan,
  { maxDueInDays }: { maxDueInDays?: number } = {},
): GoalPlan {
  const horizon = Math.max(
    0,
    Math.min(PLAN_LIMITS.horizonDays, maxDueInDays ?? PLAN_LIMITS.horizonDays),
  );

  return {
    summary: raw.summary.trim().slice(0, 600),
    milestones: uniqueByTitle(
      raw.milestones.map((item) => ({
        title: clean(item.title, ITEM_TITLE_MAX_LENGTH),
      })),
      PLAN_LIMITS.milestones,
    ),
    tasks: uniqueByTitle(
      raw.tasks.map((item) => ({
        title: clean(item.title, ITEM_TITLE_MAX_LENGTH),
        dueInDays: Math.min(horizon, Math.max(0, Math.round(item.dueInDays))),
      })),
      PLAN_LIMITS.tasks,
    ),
    habits: uniqueByTitle(
      raw.habits.map((item) => {
        const weekdays = [...new Set(item.weekdays)]
          .filter((day) => WEEKDAYS.includes(day as (typeof WEEKDAYS)[number]))
          .sort((a, b) => a - b);
        return {
          title: clean(item.title, HABIT_TITLE_MAX_LENGTH),
          weekdays: weekdays.length > 0 ? weekdays : [...WEEKDAYS],
        };
      }),
      PLAN_LIMITS.habits,
    ),
  };
}

/** Éléments du plan que l'utilisateur garde : revalidés côté serveur avant création. */
export const goalPlanSelectionSchema = z.object({
  milestones: z
    .array(z.string().trim().min(1).max(ITEM_TITLE_MAX_LENGTH))
    .max(PLAN_LIMITS.milestones),
  tasks: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(ITEM_TITLE_MAX_LENGTH),
        dueInDays: z.number().int().min(0).max(PLAN_LIMITS.horizonDays),
      }),
    )
    .max(PLAN_LIMITS.tasks),
  habits: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(HABIT_TITLE_MAX_LENGTH),
        weekdays: z
          .array(z.number().int().min(1).max(7))
          .min(1)
          .max(7)
          .refine((days) => new Set(days).size === days.length),
      }),
    )
    .max(PLAN_LIMITS.habits),
});

export type GoalPlanSelection = z.infer<typeof goalPlanSelectionSchema>;

// Avant le plan, Get iT AI pose quelques questions sur la situation de la
// personne (ex. son poids actuel, sa fréquence d'entraînement). Les réponses
// sont ajoutées à la demande de plan, citées comme du texte (jamais comme consignes).

export const QUESTION_LIMITS = {
  /** Questions posées au plus. */
  questions: 5,
  question: 200,
  hint: 80,
  /** Réponse de la personne, en caractères. */
  answer: 500,
} as const;

/** Sortie structurée demandée au modèle ; bornée ensuite par `normalizeGoalQuestions`. */
export const aiGoalQuestionsSchema = z.object({
  intro: z.string(),
  questions: z.array(z.object({ question: z.string(), hint: z.string() })),
});

export type AiGoalQuestions = z.infer<typeof aiGoalQuestionsSchema>;

export type GoalQuestions = {
  /** Une phrase d'accueil, adressée à la personne. */
  intro: string;
  /** `hint` : un exemple de réponse, affiché dans le champ. */
  questions: { question: string; hint: string }[];
};

/** Questions nettoyées : textes bornés, vides retirées, 5 au plus. */
export function normalizeGoalQuestions(raw: AiGoalQuestions): GoalQuestions {
  return {
    intro: clean(raw.intro, 300),
    questions: raw.questions
      .map((item) => ({
        question: clean(item.question, QUESTION_LIMITS.question),
        hint: clean(item.hint, QUESTION_LIMITS.hint),
      }))
      .filter((item) => item.question.length > 0)
      .slice(0, QUESTION_LIMITS.questions),
  };
}

/** Réponses envoyées avec la demande de plan (les vides sont ignorées). */
export const goalAnswersSchema = z
  .array(
    z.object({
      question: z.string().trim().max(QUESTION_LIMITS.question),
      answer: z.string().trim().max(QUESTION_LIMITS.answer),
    }),
  )
  .max(QUESTION_LIMITS.questions)
  .transform((answers) =>
    answers.filter((item) => item.question && item.answer),
  );

export type GoalAnswers = z.infer<typeof goalAnswersSchema>;
