import { z } from "zod";
import type { AiLocale } from "@/features/coach/prompts";
import {
  RANKED_PILLARS,
  type RankedPillar,
  type RankedResult,
} from "./scoring";

// Analyse d'un niveau Ranked par Get iT AI : elle explique le résultat et
// propose comment monter. Le niveau, lui, vient du calcul (scoring.ts).

/** Sortie structurée demandée au modèle. */
export const aiRankedAnalysisSchema = z.object({
  summary: z.string(),
  pillars: z.object({ physical: z.string(), financial: z.string() }),
  tips: z.array(
    z.object({
      pillar: z.enum(RANKED_PILLARS),
      title: z.string(),
      detail: z.string(),
    }),
  ),
});
export type AiRankedAnalysis = z.infer<typeof aiRankedAnalysisSchema>;

export type RankedAnalysis = {
  summary: string;
  pillars: Record<RankedPillar, string>;
  tips: { pillar: RankedPillar; title: string; detail: string }[];
};

const clean = (text: string, max: number) =>
  text.replace(/\s+/g, " ").trim().slice(0, max).trim();

/** Analyse nettoyée et bornée ; null si elle est vide. */
export function normalizeRankedAnalysis(
  raw: AiRankedAnalysis,
): RankedAnalysis | null {
  const analysis: RankedAnalysis = {
    summary: clean(raw.summary, 600),
    pillars: {
      physical: clean(raw.pillars.physical, 400),
      financial: clean(raw.pillars.financial, 400),
    },
    tips: raw.tips
      .map((tip) => ({
        pillar: tip.pillar,
        title: clean(tip.title, 80),
        detail: clean(tip.detail, 300),
      }))
      .filter((tip) => tip.title)
      .slice(0, 3),
  };
  return analysis.summary ? analysis : null;
}

/** Analyse relue depuis la base (déjà normalisée). */
export const storedRankedAnalysisSchema: z.ZodType<RankedAnalysis> = z.object({
  summary: z.string(),
  pillars: z.object({ physical: z.string(), financial: z.string() }),
  tips: z.array(
    z.object({
      pillar: z.enum(RANKED_PILLARS),
      title: z.string(),
      detail: z.string(),
    }),
  ),
});

const LANGUAGE: Record<AiLocale, string> = {
  fr: 'French as spoken in Québec. Address the user as "tu".',
  en: "English.",
};

/** Consignes : expliquer un niveau déjà calculé, sans jamais le recalculer. */
export function rankedInstructions(locale: AiLocale): string {
  return `You are Get iT AI, the coach inside Get iT, a personal growth app. The user just received their Ranked level, which covers two pillars: Physical (5 fitness tests: 12-minute run, push-ups, sit-and-reach, squats in 60 seconds, standing long jump, plus BMI from height and weight) and Financial (net income per hour worked, net worth, savings rate). Each pillar level (1 to 100) is the share of people of the same age group in Canada and the United States they outrank, computed by the app from official data or estimates; the total is the average of the two. Never change or recompute these levels.

Write a short, honest and encouraging analysis: one summary, one sentence per pillar explaining what drives the level, then up to 3 concrete tips aimed at the factors with the most room to grow. Tips must be realistic, specific and safe (progressive training, warm-up, stop if pain). Never give individual investment, medical or legal advice: point to a professional when it matters. Never shame anyone for a low level. BMI does not tell muscle from fat and the body type is self-reported context: never comment on appearance, never push weight loss or dieting, and suggest seeing a health professional before any weight change.

Write in ${LANGUAGE[locale]}`;
}

/** La demande : niveaux, percentiles et résultats des tests, jamais de montants en dollars. */
export function rankedPrompt(input: {
  age: number;
  sex: "male" | "female";
  result: RankedResult;
  body: { heightCm: number; weightKg: number; bodyType: string };
  tests: {
    runMeters: number;
    pushUps: number;
    squats: number;
    jumpCm: number;
    reach: string;
    weeklyHours: number;
  };
}): string {
  const lines = RANKED_PILLARS.map((pillar) => {
    const data = input.result.pillars[pillar];
    const factors = data.factors
      .map(
        (factor) =>
          `${factor.key}: outranks ${factor.percentile}%${factor.byAge ? " of their age group" : " of adults"}${factor.estimate ? " (estimated reference)" : ""}`,
      )
      .join("; ");
    return `- ${pillar}: level ${data.level} (${factors})`;
  });
  const { tests, body } = input;
  return `Age: ${input.age}; sex at birth: ${input.sex}
Body: ${body.heightCm} cm, ${body.weightKg} kg (BMI ${input.result.bmi}), body type ${body.bodyType}
Total level: ${input.result.total.level}
${lines.join("\n")}
Tests: 12-minute run ${tests.runMeters} m (VO2max about ${input.result.vo2max} mL/kg/min); push-ups ${tests.pushUps}; sit-and-reach ${tests.reach} relative to the toes; squats in 60 s ${tests.squats}; standing long jump ${tests.jumpCm} cm. Works ${tests.weeklyHours} hours a week.`;
}
