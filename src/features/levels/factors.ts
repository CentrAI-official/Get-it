import { z } from "zod";
import { REACH_SIDES } from "@/features/ranked/questionnaire";
import { oneRepMax, savingsRate } from "@/features/ranked/scoring";
import { WEIGHT_UNITS, type WeightUnit } from "@/features/workouts/rules";

// Les mesures qui donnent un niveau (décision du fondateur, 2026-11-01) : six
// tests physiques et trois mesures financières. Chacune est enregistrée à part
// (`measurements`), avec son historique ; le niveau d'un pilier est celui de sa
// mesure la plus faible (scale.ts). Le mental et le social n'ont pas de niveau.

export const LEVEL_PILLARS = ["physical", "financial"] as const;
export type LevelPillar = (typeof LEVEL_PILLARS)[number];

export const PHYSICAL_FACTORS = [
  "run",
  "pushUps",
  "reach",
  "squats",
  "jump",
  "bench",
] as const;
export const FINANCIAL_FACTORS = ["hourly", "netWorth", "savings"] as const;
/** Alignée sur la contrainte de la migration (un test le vérifie). */
export const LEVEL_FACTORS = [
  ...PHYSICAL_FACTORS,
  ...FINANCIAL_FACTORS,
] as const;
export type LevelFactor = (typeof LEVEL_FACTORS)[number];

export const PILLAR_FACTORS: Record<LevelPillar, readonly LevelFactor[]> = {
  physical: PHYSICAL_FACTORS,
  financial: FINANCIAL_FACTORS,
};

export function factorPillar(factor: LevelFactor): LevelPillar {
  return (PHYSICAL_FACTORS as readonly string[]).includes(factor)
    ? "physical"
    : "financial";
}

/**
 * Délai avant de refaire une même mesure : 7 jours pour un test physique, un
 * mois pour les finances (le revenu et l'épargne se mesurent sur un mois).
 */
export const MEASURE_COOLDOWN_DAYS: Record<LevelPillar, number> = {
  physical: 7,
  financial: 30,
};

/** La mesure peut-elle être refaite ? `lastAt` : la dernière, ou null. */
export function measureAvailableAt(factor: LevelFactor, lastAt: Date | null) {
  if (!lastAt) return null;
  const days = MEASURE_COOLDOWN_DAYS[factorPillar(factor)];
  return new Date(lastAt.getTime() + days * 86_400_000);
}

/**
 * Une faute de saisie (kg au lieu de lb, un zéro de trop) se corrige pendant
 * 48 heures (décision du fondateur, 2026-11-08) : la correction remplace la
 * dernière mesure, à la même date ; ensuite, il faut attendre le délai.
 */
export const MEASURE_CORRECTION_HOURS = 48;

/** Fin de la correction possible d'une mesure faite à `measuredAt`. */
export function measureCorrectableUntil(measuredAt: Date) {
  return new Date(measuredAt.getTime() + MEASURE_CORRECTION_HOURS * 3_600_000);
}

/**
 * Situation d'emploi (décision du fondateur, 2026-11-08) : demandée avec le
 * revenu, gardée avec la mesure. Le calcul ne change pas : sans heures de
 * travail, le revenu est ramené à un temps plein.
 */
export const EMPLOYMENT_STATUSES = [
  "full_time",
  "part_time",
  "self_employed",
  "student",
  "unemployed",
  "retired",
] as const;
export type EmploymentStatus = (typeof EMPLOYMENT_STATUSES)[number];

const POUND_KG = 0.45359237;
/** Une valeur dans l'unité choisie → kilogrammes. */
export const toKilograms = (value: number, unit: WeightUnit) =>
  unit === "kg" ? value : value * POUND_KG;
/** Kilogrammes → valeur dans l'unité choisie. */
export const fromKilograms = (kg: number, unit: WeightUnit) =>
  unit === "kg" ? kg : kg / POUND_KG;

const integer = (min: number, max: number) =>
  z.coerce.number().int().min(min).max(max);

/** Champs du formulaire et leur validation (libellés dans Levels.fields). */
export const MEASURE_FIELDS = {
  runMeters: integer(200, 6000),
  pushUps: integer(0, 300),
  reachSide: z.enum(REACH_SIDES),
  reachCm: integer(0, 60),
  squats: integer(0, 150),
  jumpCm: integer(20, 400),
  /** Unité du poids du corps et de la charge (préférence du carnet d'entraînement). */
  weightUnit: z.enum(WEIGHT_UNITS),
  /** Poids du corps dans l'unité choisie : 30 à 300 kg (vérifié après conversion). */
  bodyWeight: z.coerce.number().min(30).max(700),
  /** Charge soulevée dans l'unité choisie, au demi près : 500 kg au plus. */
  benchLoad: z.coerce.number().min(1).max(1200).multipleOf(0.5),
  /** Répétitions faites avec cette charge (au plus 10 pour une estimation fiable). */
  benchReps: integer(1, 10),
  employment: z.enum(EMPLOYMENT_STATUSES),
  netIncome: integer(0, 1_000_000_000),
  weeklyHours: integer(0, 100),
  assets: integer(0, 100_000_000_000),
  debts: integer(0, 10_000_000_000),
  monthlyExpenses: integer(0, 100_000_000),
} as const;
export type MeasureField = keyof typeof MEASURE_FIELDS;

/** Champs demandés pour chaque mesure, dans l'ordre du formulaire. */
export const FACTOR_FIELDS: Record<LevelFactor, readonly MeasureField[]> = {
  run: ["runMeters"],
  pushUps: ["pushUps"],
  reach: ["reachSide", "reachCm"],
  squats: ["squats"],
  jump: ["jumpCm"],
  bench: ["weightUnit", "bodyWeight", "benchLoad", "benchReps"],
  hourly: ["employment", "netIncome", "weeklyHours"],
  netWorth: ["assets", "debts"],
  savings: ["netIncome", "monthlyExpenses"],
};

/** Champs de plusieurs mesures, sans doublon (le revenu sert à deux mesures). */
export function fieldsOf(factors: readonly LevelFactor[]): MeasureField[] {
  return [...new Set(factors.flatMap((factor) => FACTOR_FIELDS[factor]))];
}

/** Validation des réponses d'un formulaire de mesures. */
export function measureAnswersSchema(factors: readonly LevelFactor[]) {
  const fields = fieldsOf(factors);
  return z
    .object(
      Object.fromEntries(
        fields.map((field) => [field, MEASURE_FIELDS[field]]),
      ) as { [K in MeasureField]: (typeof MEASURE_FIELDS)[K] },
    )
    .superRefine((answers, context) => {
      if (!fields.includes("bodyWeight")) return;
      // Les limites valent en kilogrammes, quelle que soit l'unité choisie
      const unit = answers.weightUnit;
      const weight = toKilograms(answers.bodyWeight, unit);
      if (weight < 30 || weight > 300) {
        context.addIssue({
          code: "custom",
          path: ["bodyWeight"],
          message: "range",
        });
      }
      if (toKilograms(answers.benchLoad, unit) > 500) {
        context.addIssue({
          code: "custom",
          path: ["benchLoad"],
          message: "range",
        });
      }
    });
}
export type MeasureAnswers = {
  [K in MeasureField]: z.infer<(typeof MEASURE_FIELDS)[K]>;
};

/** Mesures envoyées : une ou plusieurs d'un même pilier, sans doublon. */
export const measureRequestSchema = z
  .object({
    factors: z.array(z.enum(LEVEL_FACTORS)).min(1).max(PHYSICAL_FACTORS.length),
    answers: z.record(z.string(), z.unknown()),
    /** Accord (Loi 25) : obligatoire pour la première mesure d'un pilier. */
    consent: z.boolean(),
    /** Corriger la dernière mesure (faute de saisie, dans les 48 h). */
    correct: z.boolean().optional(),
  })
  .refine(
    ({ factors }) =>
      new Set(factors).size === factors.length &&
      new Set(factors.map(factorPillar)).size === 1,
  );

export type MeasuredValue = {
  /** Valeur dans l'unité de la mesure (voir `factorValue`). */
  value: number;
  /** Ce qui a été répondu, gardé pour l'historique (jamais montré aux autres). */
  details: Record<string, number | string>;
};

const round1 = (value: number) => Math.round(value * 10) / 10;

/** Heures par semaine d'un revenu sans heures de travail : un temps plein. */
const FULL_TIME_HOURS = 40;

/**
 * Valeur d'une mesure dans son unité : mètres en 12 minutes, répétitions,
 * centimètres au-delà des orteils (négatifs : ce qui manque), 1RM divisé par
 * le poids, revenu net par heure, valeur nette (actifs moins dettes) et taux
 * d'épargne (de -1 à 1).
 */
export function factorValue(
  factor: LevelFactor,
  answers: Partial<MeasureAnswers>,
): MeasuredValue {
  const a = answers as MeasureAnswers;
  switch (factor) {
    case "run":
      return { value: a.runMeters, details: { runMeters: a.runMeters } };
    case "pushUps":
      return { value: a.pushUps, details: { pushUps: a.pushUps } };
    case "reach":
      return {
        value: (a.reachSide === "beyond" ? 1 : -1) * a.reachCm,
        details: { reachSide: a.reachSide, reachCm: a.reachCm },
      };
    case "squats":
      return { value: a.squats, details: { squats: a.squats } };
    case "jump":
      return { value: a.jumpCm, details: { jumpCm: a.jumpCm } };
    case "bench": {
      // Le calcul se fait en kilogrammes ; ce qui a été tapé est gardé tel quel
      const weightKg = round1(toKilograms(a.bodyWeight, a.weightUnit));
      const benchKg = round1(toKilograms(a.benchLoad, a.weightUnit));
      return {
        value:
          Math.round((oneRepMax(benchKg, a.benchReps) / weightKg) * 100) / 100,
        details: {
          weightUnit: a.weightUnit,
          bodyWeight: a.bodyWeight,
          benchLoad: a.benchLoad,
          weightKg,
          benchKg,
          benchReps: a.benchReps,
        },
      };
    }
    case "hourly":
      return {
        value: a.netIncome / ((a.weeklyHours || FULL_TIME_HOURS) * 52),
        details: {
          employment: a.employment,
          netIncome: a.netIncome,
          weeklyHours: a.weeklyHours,
        },
      };
    case "netWorth":
      return {
        value: a.assets - a.debts,
        details: { assets: a.assets, debts: a.debts },
      };
    case "savings":
      return {
        value: savingsRate(a.netIncome, a.monthlyExpenses),
        details: {
          netIncome: a.netIncome,
          monthlyExpenses: a.monthlyExpenses,
        },
      };
  }
}
