import "server-only";
import { z } from "zod";
import {
  rankedInstructions,
  rankedPrompt,
  storedRankedAnalysisSchema,
  type RankedAnalysis,
} from "@/features/ranked/analysis";
import {
  rankedRecordSchema,
  type RankedAnswers,
  type RankedRecord,
} from "@/features/ranked/questionnaire";
import { nextEvaluationAt, type RankedError } from "@/features/ranked/rules";
import {
  evaluateRanked,
  RANKED_FACTORS,
  type RankedPillar,
  type RankedResult,
} from "@/features/ranked/scoring";
import { getAiProvider } from "@/server/ai/provider";
import {
  getAiProfile,
  recordAiUsage,
  releaseAiRequest,
  reserveAiRequest,
} from "@/server/ai/usage";
import { db } from "@/server/db";
import { getRankedPerson } from "@/server/profile/details";
import { getUserTimeZone } from "@/server/profile/service";

// Mode Ranked : chaque fonction reçoit l'userId de la session et filtre dessus.
// Les niveaux physique, financier et total d'une personne classée sont
// publics ; ses réponses (revenu, patrimoine, tests) ne sont jamais montrées.
// Sans Ranked, les niveaux restent privés.

export type RankedLevels = Record<RankedPillar, number> & { total: number };

export type RankedState = {
  levels: RankedLevels;
  result: RankedResult;
  /** Réponses, avec l'âge, le sexe et le pays au moment de l'évaluation. */
  answers: RankedRecord;
  analysis: RankedAnalysis | null;
  /** « AAAA-MM-JJTHH:MM:SS.sssZ » */
  evaluatedAt: string;
  nextAt: string;
  canReevaluate: boolean;
};

const factorSchema = z.object({
  key: z.enum(RANKED_FACTORS),
  percentile: z.number(),
  weight: z.number(),
  byAge: z.boolean(),
  source: z.string(),
  estimate: z.boolean(),
});
const pillarResultSchema = z.object({
  level: z.number(),
  percentile: z.number(),
  factors: z.array(factorSchema),
});
/** Détail du calcul relu depuis la base (écrit par evaluateRanked). */
const storedResultSchema: z.ZodType<RankedResult> = z.object({
  pillars: z.object({
    physical: pillarResultSchema,
    financial: pillarResultSchema,
  }),
  total: z.object({ level: z.number(), percentile: z.number() }),
  vo2max: z.number(),
  bmi: z.number(),
});

const levelsSelect = { physical: true, financial: true, total: true } as const;

/** Niveaux Ranked les plus récents d'une personne, ou null si elle n'est pas classée. */
export async function getRankedLevels(
  userId: string,
): Promise<RankedLevels | null> {
  return db.rankedEvaluation.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: levelsSelect,
  });
}

/** État complet du mode Ranked pour la personne elle-même. */
export async function getRankedState(
  userId: string,
): Promise<RankedState | null> {
  const latest = await db.rankedEvaluation.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      ...levelsSelect,
      answers: true,
      result: true,
      analysis: true,
      createdAt: true,
    },
  });
  if (!latest) return null;
  const answers = rankedRecordSchema.safeParse(latest.answers);
  const result = storedResultSchema.safeParse(latest.result);
  if (!answers.success || !result.success) return null;
  const analysis = storedRankedAnalysisSchema.safeParse(latest.analysis);
  const nextAt = nextEvaluationAt(latest.createdAt);
  return {
    levels: {
      physical: latest.physical,
      financial: latest.financial,
      total: latest.total,
    },
    result: result.data,
    answers: answers.data,
    analysis: analysis.success ? analysis.data : null,
    evaluatedAt: latest.createdAt.toISOString(),
    nextAt: nextAt.toISOString(),
    canReevaluate: nextAt.getTime() <= Date.now(),
  };
}

/**
 * Calcule et enregistre un niveau Ranked, au plus une fois tous les 30 jours.
 * Le niveau vient des tableaux de référence (scoring.ts), jamais de l'IA. L'âge,
 * le sexe et le pays viennent du compte (jamais redemandés), et sont gardés
 * avec les réponses tels qu'ils étaient au moment de l'évaluation.
 */
export async function submitRanked(
  userId: string,
  answers: RankedAnswers,
): Promise<
  { ok: true; levels: RankedLevels } | { ok: false; error: RankedError }
> {
  const latest = await db.rankedEvaluation.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (latest && nextEvaluationAt(latest.createdAt).getTime() > Date.now()) {
    return { ok: false, error: "tooSoon" };
  }
  const person = await getRankedPerson(userId, await getUserTimeZone(userId));
  if (!person) return { ok: false, error: "detailsMissing" };
  const result = evaluateRanked(answers, person);
  const record: RankedRecord = { ...answers, ...person };
  const levels: RankedLevels = {
    physical: result.pillars.physical.level,
    financial: result.pillars.financial.level,
    total: result.total.level,
  };
  await db.rankedEvaluation.create({
    data: { userId, answers: record, result, ...levels },
  });
  return { ok: true, levels };
}

/** Quitte le mode Ranked : les réponses et les niveaux sont effacés. */
export async function leaveRanked(userId: string) {
  await db.rankedEvaluation.deleteMany({ where: { userId } });
}

/**
 * Analyse du dernier niveau par Get iT AI (une seule fois par évaluation) :
 * accord requis, compte dans la limite quotidienne. Les finances ne sont
 * envoyées qu'en percentiles, jamais en dollars.
 */
export async function analyzeRanked(
  userId: string,
): Promise<{ ok: true } | { ok: false; error: RankedError }> {
  const provider = getAiProvider();
  if (!provider) return { ok: false, error: "notConfigured" };
  const profile = await getAiProfile(userId);
  if (!profile?.consented) return { ok: false, error: "aiConsentRequired" };
  const latest = await db.rankedEvaluation.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, answers: true, result: true, analysis: true },
  });
  if (!latest) return { ok: false, error: "notRanked" };
  if (latest.analysis) return { ok: true };
  const answers = rankedRecordSchema.safeParse(latest.answers);
  const result = storedResultSchema.safeParse(latest.result);
  if (!answers.success || !result.success) {
    return { ok: false, error: "unexpected" };
  }

  const reservation = await reserveAiRequest(
    userId,
    "ranked_analysis",
    profile.timeZone,
  );
  if (!reservation) return { ok: false, error: "limitReached" };
  const response = await provider
    .generateRankedAnalysis({
      system: rankedInstructions(profile.locale),
      prompt: rankedPrompt({
        age: answers.data.age,
        sex: answers.data.sex,
        result: result.data,
        body: {
          heightCm: answers.data.heightCm,
          weightKg: answers.data.weightKg,
          bodyType: answers.data.bodyType,
        },
        tests: {
          runMeters: answers.data.runMeters,
          pushUps: answers.data.pushUps,
          squats: answers.data.squats,
          jumpCm: answers.data.jumpCm,
          reach: `${answers.data.reachSide === "beyond" ? "+" : "-"}${answers.data.reachCm} cm`,
          weeklyHours: answers.data.weeklyHours,
        },
      }),
    })
    .catch(async (error: unknown) => {
      await releaseAiRequest(reservation.id).catch(() => {});
      throw error;
    });
  await recordAiUsage(reservation.id, response.usage);
  if (response.refused) return { ok: false, error: "refused" };
  if (!response.analysis) return { ok: false, error: "unexpected" };
  await db.rankedEvaluation.update({
    where: { id: latest.id },
    data: { analysis: response.analysis },
  });
  return { ok: true };
}

/**
 * Niveau montré aux autres (fil, Messagerie, contacts) : seulement le niveau
 * total des personnes classées ; sans Ranked, le niveau reste privé (absent).
 */
export async function getDisplayLevels(userIds: string[]) {
  const levels = new Map<string, number>();
  if (userIds.length === 0) return levels;
  const rows = await db.rankedEvaluation.findMany({
    where: { userId: { in: userIds } },
    orderBy: { createdAt: "desc" },
    select: { userId: true, total: true },
  });
  // Lignes triées de la plus récente à la plus ancienne : la première compte
  for (const row of rows) {
    if (!levels.has(row.userId)) levels.set(row.userId, row.total);
  }
  return levels;
}

/** Niveaux Ranked publics d'une personne (total, physique, financier), ou null. */
export async function getPublicRanked(userId: string) {
  return getRankedLevels(userId);
}
