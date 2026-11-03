"use server";

import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import {
  deleteWorkout,
  reopenWorkout,
  setWeightUnit,
  syncWorkout,
  type WorkoutResult,
} from "@/server/workouts/service";
import { WEIGHT_UNITS, workoutSyncSchema } from "./rules";

// Points d'entrée publics du carnet : session et saisies revalidées ici. Le
// serveur relit les exercices dans le plan, jamais dans ce que le navigateur envoie.

/** Reçoit ce que le téléphone a noté depuis le dernier envoi. */
export async function syncWorkoutAction(
  input: unknown,
): Promise<WorkoutResult> {
  const user = await requireUser();
  const parsed = workoutSyncSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return syncWorkout(user.id, parsed.data);
}

const sessionSchema = z.object({
  day: z.iso.date(),
  weekday: z.number().int().min(1).max(7),
});

/** « Continuer la séance » après l'avoir terminée. */
export async function reopenWorkoutAction(input: unknown) {
  const user = await requireUser();
  const parsed = sessionSchema.safeParse(input);
  if (!parsed.success) return false;
  return reopenWorkout(user.id, parsed.data.day, parsed.data.weekday);
}

/** Supprime une séance et ses séries. */
export async function deleteWorkoutAction(input: unknown) {
  const user = await requireUser();
  const parsed = sessionSchema.safeParse(input);
  if (!parsed.success) return false;
  return deleteWorkout(user.id, parsed.data.day, parsed.data.weekday);
}

/** Choix kg ou lb, gardé dans les réglages de la personne. */
export async function setWeightUnitAction(unit: unknown) {
  const user = await requireUser();
  const parsed = z.enum(WEIGHT_UNITS).safeParse(unit);
  if (!parsed.success) return false;
  await setWeightUnit(user.id, parsed.data);
  return true;
}
