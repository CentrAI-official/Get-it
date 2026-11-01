"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import {
  eraseLevels,
  recordMeasurements,
  setRanked,
  type RecordResult,
} from "@/server/levels/service";
import { measureRequestSchema } from "./factors";

// Points d'entrée publics : session et entrées revalidées ici ; le service
// revérifie l'accord, le délai entre deux mesures et les renseignements du
// compte (âge, sexe, pays).

/** Enregistre une ou plusieurs mesures d'un pilier, puis les objectifs de niveau. */
export async function recordMeasurementsAction(
  input: unknown,
): Promise<RecordResult> {
  const user = await requireUser();
  const parsed = measureRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  try {
    const result = await recordMeasurements(user.id, parsed.data);
    if (result.ok) refresh();
    return result;
  } catch (error) {
    console.error("Mesure impossible à enregistrer", error);
    return { ok: false, error: "unexpected" };
  }
}

/** Mode Ranked : rendre ses niveaux publics (classement), ou les garder privés. */
export async function setRankedAction(ranked: unknown): Promise<boolean> {
  const user = await requireUser();
  const parsed = z.boolean().safeParse(ranked);
  if (!parsed.success) return false;
  await setRanked(user.id, parsed.data);
  refresh();
  return true;
}

/** Efface toutes les mesures, les niveaux et les objectifs de niveau en cours. */
export async function eraseLevelsAction(): Promise<boolean> {
  const user = await requireUser();
  await eraseLevels(user.id);
  refresh();
  return true;
}
