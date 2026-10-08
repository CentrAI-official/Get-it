import { z } from "zod";
import { PILLARS, type Pillar } from "@/config/pillars";

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

/** Autoévaluation de 1 à 5 ; la clé de traduction décrit chaque niveau. */
export const ASSESSMENT_LEVELS = [
  { score: 1, key: "start" },
  { score: 2, key: "beginner" },
  { score: 3, key: "progressing" },
  { score: 4, key: "solid" },
  { score: 5, key: "excellent" },
] as const;

export const DISPLAY_NAME_MAX_LENGTH = 50;
export const GOAL_TITLE_MIN_LENGTH = 2;
export const GOAL_TITLE_MAX_LENGTH = 120;
/** Peu d'objectifs à la fois : mieux vaut avancer sur l'essentiel. */
export const MAX_GOALS = 5;

const pillar = z.enum(PILLARS);

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
    ),
});

export const situationStepSchema = z.object({
  assessments: z.partialRecord(pillar, z.int().min(1).max(5)),
});

export const timeStepSchema = z.object({
  dailyMinutes: z.literal(
    DAILY_MINUTES_OPTIONS.map((option) => option.minutes),
  ),
});

/** Réponses complètes, revalidées par le serveur avant tout enregistrement. */
export const onboardingSchema = z
  .object({
    ...aboutStepSchema.shape,
    ...pillarsStepSchema.shape,
    ...goalsStepSchema.shape,
    ...situationStepSchema.shape,
    ...timeStepSchema.shape,
  })
  .refine(
    (data) => data.goals.every((goal) => data.pillars.includes(goal.pillar)),
    { path: ["goals"] },
  )
  .refine(
    (data) => {
      const assessed = Object.keys(data.assessments).sort();
      return assessed.join() === [...data.pillars].sort().join();
    },
    { path: ["assessments"] },
  );

export type OnboardingInput = z.infer<typeof onboardingSchema>;

/** Réponses en cours dans l'assistant (étapes pas encore toutes remplies). */
export type OnboardingDraft = {
  displayName: string;
  occupation: Occupation | null;
  pillars: Pillar[];
  goals: { title: string; pillar: Pillar }[];
  assessments: Partial<Record<Pillar, number>>;
  dailyMinutes: DailyMinutes | null;
};

/** Idées d'objectifs proposées pour chaque pilier (clés de `Onboarding.goals.suggestions`). */
export const GOAL_SUGGESTIONS = {
  physical: ["workout", "run5k", "sleep"],
  mental: ["meditate", "read", "stress"],
  social: ["confidence", "meetPeople", "communication"],
  financial: ["save", "budget", "business"],
} as const satisfies Record<Pillar, readonly string[]>;
