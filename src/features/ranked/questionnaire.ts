import { z } from "zod";

// Questionnaire du mode Ranked (physique et financier) : défini une seule fois,
// pour le formulaire et la validation serveur. Les libellés vivent dans
// Ranked.questions (fr, en).

export const RANKED_COUNTRIES = ["CA", "US"] as const;
export type RankedCountry = (typeof RANKED_COUNTRIES)[number];

/** Normes de forme physique à utiliser (sans précision : moyenne des deux). */
export const SEX_NORMS = ["male", "female", "unspecified"] as const;
/** Flexion assise : les doigts dépassent les orteils, ou il manque des centimètres. */
export const REACH_SIDES = ["beyond", "short"] as const;

export const RANKED_MIN_AGE = 16;
export const RANKED_MAX_AGE = 100;

const integer = (min: number, max: number) =>
  z.coerce.number().int().min(min).max(max);

export const rankedAnswersSchema = z.object({
  country: z.enum(RANKED_COUNTRIES),
  age: integer(RANKED_MIN_AGE, RANKED_MAX_AGE),
  sexNorm: z.enum(SEX_NORMS),
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

/** Champs du formulaire, dans l'ordre, regroupés par section. */
export const RANKED_SECTIONS = [
  { key: "about", fields: ["country", "age", "sexNorm"] },
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
