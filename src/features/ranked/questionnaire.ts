import { z } from "zod";
import {
  COUNTRIES,
  MAX_AGE,
  MIN_AGE,
  SEXES,
  type Country,
} from "@/features/profile/details";

// Questionnaire du mode Ranked (physique et financier) : défini une seule fois,
// pour le formulaire et la validation serveur. Les libellés vivent dans
// Ranked.questions (fr, en). L'âge, le sexe et le pays ne sont pas redemandés :
// ils viennent du compte (src/features/profile/details.ts).

export type RankedCountry = Country;

/** Flexion assise : les doigts dépassent les orteils, ou il manque des centimètres. */
export const REACH_SIDES = ["beyond", "short"] as const;

/** Morphologie (somatotype) : montrée en silhouettes, gardée comme contexte. */
export const BODY_TYPES = ["ectomorph", "mesomorph", "endomorph"] as const;
export type BodyType = (typeof BODY_TYPES)[number];

const integer = (min: number, max: number) =>
  z.coerce.number().int().min(min).max(max);

export const rankedAnswersSchema = z.object({
  // Corps
  /** Taille en centimètres. */
  heightCm: integer(100, 250),
  /** Poids en kilogrammes. */
  weightKg: integer(30, 300),
  bodyType: z.enum(BODY_TYPES),
  // Physique
  reachSide: z.enum(REACH_SIDES),
  /** Centimètres au-delà des orteils, ou qui manquent pour les toucher. */
  reachCm: integer(0, 60),
  /** Distance parcourue en 12 minutes, en mètres. */
  runMeters: integer(200, 6000),
  pushUps: integer(0, 300),
  /** Squats complets en 60 secondes. */
  squats: integer(0, 150),
  /** Saut en longueur sans élan, meilleur de 3 essais, en cm. */
  jumpCm: integer(20, 400),
  // Financier (dans la devise du pays)
  /** Revenu net des 12 derniers mois, après impôts et retenues. */
  netIncome: integer(0, 1_000_000_000),
  assets: integer(0, 100_000_000_000),
  debts: integer(0, 10_000_000_000),
  /** Dépenses courantes par mois, sans l'épargne ni les placements. */
  monthlyExpenses: integer(0, 100_000_000),
  /** Heures de travail par semaine pour gagner ce revenu. */
  weeklyHours: integer(0, 100),
});

export type RankedAnswers = z.infer<typeof rankedAnswersSchema>;

/** Âge, sexe et pays tirés du compte au moment de l'évaluation. */
export const rankedPersonSchema = z.object({
  country: z.enum(COUNTRIES),
  age: integer(MIN_AGE, MAX_AGE),
  sex: z.enum(SEXES),
});
export type RankedPerson = z.infer<typeof rankedPersonSchema>;

/** Ce qui est enregistré : les réponses et la personne telle qu'elle était évaluée. */
export const rankedRecordSchema = rankedAnswersSchema.extend(
  rankedPersonSchema.shape,
);
export type RankedRecord = z.infer<typeof rankedRecordSchema>;

/** Champs du formulaire, dans l'ordre, regroupés par section. */
export const RANKED_SECTIONS = [
  { key: "body", fields: ["heightCm", "weightKg", "bodyType"] },
  {
    key: "physical",
    fields: [
      "reachSide",
      "reachCm",
      "runMeters",
      "pushUps",
      "squats",
      "jumpCm",
    ],
  },
  {
    key: "financial",
    fields: ["netIncome", "assets", "debts", "monthlyExpenses", "weeklyHours"],
  },
] as const;
