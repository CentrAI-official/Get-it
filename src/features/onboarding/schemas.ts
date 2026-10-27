import { z } from "zod";
import { PILLARS, type Pillar } from "@/config/pillars";
import { ACCOUNT_TYPES, type AccountType } from "@/features/marketplace/rules";
import type { ProfileDetailsDraft } from "@/features/profile/details";
import {
  ACTIVE_GOALS_PER_PILLAR,
  GOAL_TITLE_MAX_LENGTH,
  GOAL_TITLE_MIN_LENGTH,
} from "@/features/goals/schemas";

export { GOAL_TITLE_MAX_LENGTH, GOAL_TITLE_MIN_LENGTH };

/** Doit rester aligné avec l'enum Occupation de prisma/schema.prisma (un test le vérifie). */
export const OCCUPATIONS = [
  "student",
  "employee",
  "self_employed",
  "entrepreneur",
  "job_seeker",
  "other",
] as const;
export type Occupation = (typeof OCCUPATIONS)[number];

/** Temps quotidien proposé, en minutes, et clé de traduction associée. */
export const DAILY_MINUTES_OPTIONS = [
  { minutes: 15, key: "min15" },
  { minutes: 30, key: "min30" },
  { minutes: 60, key: "min60" },
  { minutes: 120, key: "min120" },
] as const;
export type DailyMinutes = (typeof DAILY_MINUTES_OPTIONS)[number]["minutes"];

export const DISPLAY_NAME_MAX_LENGTH = 50;
/** Peu d'objectifs à la fois : mieux vaut avancer sur l'essentiel. */
export const MAX_GOALS = 5;

const pillar = z.enum(PILLARS);

/** Consommateur, ou affilié (peut aussi vendre dans le Marketplace). */
export const accountStepSchema = z.object({
  accountType: z.enum(ACCOUNT_TYPES),
});

export const aboutStepSchema = z.object({
  displayName: z.string().trim().min(1).max(DISPLAY_NAME_MAX_LENGTH),
  occupation: z.enum(OCCUPATIONS).nullable(),
});

export const pillarsStepSchema = z.object({
  pillars: z
    .array(pillar)
    .min(1)
    .refine((list) => new Set(list).size === list.length),
});

export const goalSchema = z.object({
  title: z
    .string()
    .trim()
    .min(GOAL_TITLE_MIN_LENGTH)
    .max(GOAL_TITLE_MAX_LENGTH),
  pillar,
});

export const goalsStepSchema = z.object({
  goals: z
    .array(goalSchema)
    .min(1)
    .max(MAX_GOALS)
    .refine(
      (goals) =>
        new Set(goals.map((goal) => goal.title.toLowerCase())).size ===
        goals.length,
    )
    // 3 objectifs en cours au plus par aspect
    .refine((goals) =>
      PILLARS.every(
        (item) =>
          goals.filter((goal) => goal.pillar === item).length <=
          ACTIVE_GOALS_PER_PILLAR,
      ),
    ),
});

export const timeStepSchema = z.object({
  dailyMinutes: z.literal(
    DAILY_MINUTES_OPTIONS.map((option) => option.minutes),
  ),
});

/**
 * Réponses complètes, revalidées par le serveur avant tout enregistrement. Les
 * renseignements du compte (date de naissance, sexe, région) se valident à
 * part, le jour même : `profileDetailsSchema`.
 */
export const onboardingSchema = z
  .object({
    ...accountStepSchema.shape,
    ...aboutStepSchema.shape,
    ...pillarsStepSchema.shape,
    ...goalsStepSchema.shape,
    ...timeStepSchema.shape,
  })
  .refine(
    (data) => data.goals.every((goal) => data.pillars.includes(goal.pillar)),
    { path: ["goals"] },
  );

export type OnboardingInput = z.infer<typeof onboardingSchema>;

/** Réponses en cours dans l'assistant (étapes pas encore toutes remplies). */
export type OnboardingDraft = ProfileDetailsDraft & {
  accountType: AccountType | null;
  displayName: string;
  occupation: Occupation | null;
  pillars: Pillar[];
  goals: { title: string; pillar: Pillar }[];
  dailyMinutes: DailyMinutes | null;
};

/** Idées d'objectifs proposées pour chaque pilier (clés de `Onboarding.goals.suggestions`). */
export const GOAL_SUGGESTIONS = {
  physical: ["workout", "run5k", "sleep"],
  mental: ["meditate", "read", "stress"],
  social: ["confidence", "meetPeople", "communication"],
  financial: ["save", "budget", "business"],
} as const satisfies Record<Pillar, readonly string[]>;
