"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import {
  applyPlan,
  deletePlan,
  generatePlan,
  getCalendar,
  type DevelopmentError,
} from "@/server/development/service";
import { developmentSelectionSchema } from "./plan";
import { DEVELOPMENT_KINDS } from "./questionnaires";

// Points d'entrée publics : session et entrées revalidées ici, réponses du
// questionnaire revalidées par le service.

const kindSchema = z.enum(DEVELOPMENT_KINDS);

export type GeneratePlanResult =
  | { ok: true }
  | { ok: false; error: DevelopmentError; fields?: Record<string, string> };

export async function generatePlanAction(
  kind: unknown,
  answers: unknown,
  dataConsent: unknown,
): Promise<GeneratePlanResult> {
  const user = await requireUser();
  const parsedKind = kindSchema.safeParse(kind);
  if (!parsedKind.success) return { ok: false, error: "notFound" };
  try {
    const result = await generatePlan(
      user.id,
      parsedKind.data,
      answers,
      dataConsent === true,
    );
    if (result.ok) refresh();
    return result;
  } catch (error) {
    console.error("Plan de développement impossible à générer", error);
    return { ok: false, error: "unexpected" };
  }
}

export async function applyPlanAction(kind: unknown, selection: unknown) {
  const user = await requireUser();
  const parsedKind = kindSchema.safeParse(kind);
  const parsed = developmentSelectionSchema.safeParse(selection);
  if (!parsedKind.success || !parsed.success) return false;
  const done = await applyPlan(user.id, parsedKind.data, parsed.data).catch(
    (error: unknown) => {
      console.error("Plan de développement impossible à appliquer", error);
      return false;
    },
  );
  if (done) refresh();
  return done;
}

export async function deletePlanAction(kind: unknown) {
  const user = await requireUser();
  const parsedKind = kindSchema.safeParse(kind);
  if (!parsedKind.success) return false;
  const done = await deletePlan(user.id, parsedKind.data).catch(() => false);
  if (done) refresh();
  return done;
}

/** Un autre mois du calendrier (tous les plans, ou un seul). */
export async function loadCalendarAction(scope: unknown, month: unknown) {
  const user = await requireUser();
  const parsedScope = z.union([z.literal("all"), kindSchema]).safeParse(scope);
  const parsedMonth = z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .safeParse(month);
  if (!parsedScope.success || !parsedMonth.success) return null;
  return getCalendar(user.id, parsedScope.data, parsedMonth.data).catch(
    () => null,
  );
}
