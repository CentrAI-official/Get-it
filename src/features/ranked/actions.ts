"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import {
  analyzeRanked,
  leaveRanked,
  submitRanked,
} from "@/server/ranked/service";
import { rankedAnswersSchema } from "./questionnaire";
import type { RankedError } from "./rules";

// Points d'entrée publics : session et entrées revalidées ici ; le service
// vérifie le délai de 30 jours et l'accord pour Get iT AI.

type Result = { ok: true } | { ok: false; error: RankedError };

const submitSchema = z.object({
  answers: rankedAnswersSchema,
  /** Case d'accord : renseignements financiers et de santé, niveaux publics (Loi 25). */
  consent: z.literal(true),
});

/** Calcule et enregistre le niveau Ranked. */
export async function submitRankedAction(input: unknown): Promise<Result> {
  const user = await requireUser();
  const parsed = submitSchema.safeParse(input);
  if (!parsed.success) {
    const consentMissing = parsed.error.issues.some(
      (issue) => issue.path[0] === "consent",
    );
    return { ok: false, error: consentMissing ? "consentRequired" : "invalid" };
  }
  try {
    const result = await submitRanked(user.id, parsed.data.answers);
    if (!result.ok) return result;
    refresh();
    return { ok: true };
  } catch (error) {
    console.error("Niveau Ranked impossible à calculer", error);
    return { ok: false, error: "unexpected" };
  }
}

/** Quitte le mode Ranked (efface les réponses et les niveaux). */
export async function leaveRankedAction(): Promise<boolean> {
  const user = await requireUser();
  await leaveRanked(user.id);
  refresh();
  return true;
}

/** Demande l'analyse du niveau à Get iT AI. */
export async function analyzeRankedAction(): Promise<Result> {
  const user = await requireUser();
  try {
    const result = await analyzeRanked(user.id);
    if (result.ok) refresh();
    return result;
  } catch (error) {
    console.error("Analyse Ranked impossible", error);
    return { ok: false, error: "unexpected" };
  }
}
