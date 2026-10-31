"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import { firstGoalError, type GoalErrorKey } from "@/features/goals/schemas";
import {
  applyPlan,
  deletePlan,
  generatePlan,
  getCalendar,
  removeSession,
  revisePlan,
  setSessionSchedule,
  type DevelopmentError,
} from "@/server/development/service";
import { deleteEvent } from "@/server/events/service";
import { deleteGoal } from "@/server/goals/service";
import { deleteHabit, setHabitSchedule } from "@/server/habits/service";
import { deleteTask, updateTask } from "@/server/tasks/service";
import { calendarTargetSchema, itemEditSchema } from "./calendar";
import { developmentSelectionSchema } from "./plan";
import { REVISION_MAX_LENGTH } from "./prompts";
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

/**
 * « Modifier » dans le calendrier : l'heure (ou le moment) d'une habitude,
 * d'une tâche ou d'une séance ; pour une tâche, aussi son titre et son échéance.
 */
export async function saveItemAction(
  change: unknown,
): Promise<{ ok: true } | { ok: false; error: GoalErrorKey }> {
  const user = await requireUser();
  const parsed = itemEditSchema.safeParse(change);
  if (!parsed.success)
    return { ok: false, error: firstGoalError(parsed.error) };
  const input = parsed.data;
  const schedule = { time: input.time, moment: input.moment };
  try {
    const done =
      input.type === "task"
        ? await updateTask(user.id, input.id, {
            title: input.title,
            dueDate: input.dueDate,
            ...schedule,
          })
        : input.type === "habit"
          ? await setHabitSchedule(user.id, input.id, schedule)
          : await setSessionSchedule(
              user.id,
              input.kind,
              input.weekday,
              schedule,
            );
    if (!done) return { ok: false, error: "notFound" };
  } catch (error) {
    console.error("Élément du calendrier impossible à modifier", error);
    return { ok: false, error: "unexpected" };
  }
  refresh();
  return { ok: true };
}

/**
 * « Supprimer » dans le calendrier : une tâche, un événement, une habitude
 * (et son historique), un objectif, ou la séance d'un jour de la semaine type.
 */
export async function removeCalendarItemAction(target: unknown) {
  const user = await requireUser();
  const parsed = calendarTargetSchema.safeParse(target);
  if (!parsed.success) return false;
  const input = parsed.data;
  try {
    let done: boolean;
    if (input.type === "session") {
      done = await removeSession(user.id, input.kind, input.weekday);
    } else if (input.type === "habit") {
      done = await deleteHabit(user.id, input.id);
    } else if (input.type === "goal") {
      done = await deleteGoal(user.id, input.id);
    } else if (input.type === "event") {
      done = await deleteEvent(user.id, input.id);
    } else {
      await deleteTask(user.id, input.id);
      done = true;
    }
    if (done) refresh();
    return done;
  } catch (error) {
    console.error("Élément du calendrier impossible à supprimer", error);
    return false;
  }
}

/** « Modifier mon plan » : Get iT AI applique les changements demandés. */
export async function revisePlanAction(
  kind: unknown,
  changes: unknown,
): Promise<GeneratePlanResult> {
  const user = await requireUser();
  const parsedKind = kindSchema.safeParse(kind);
  const parsedChanges = z
    .string()
    .trim()
    .min(3)
    .max(REVISION_MAX_LENGTH)
    .safeParse(changes);
  if (!parsedKind.success) return { ok: false, error: "notFound" };
  if (!parsedChanges.success) return { ok: false, error: "invalid" };
  try {
    const result = await revisePlan(
      user.id,
      parsedKind.data,
      parsedChanges.data,
    );
    if (result.ok) refresh();
    return result;
  } catch (error) {
    console.error("Plan de développement impossible à modifier", error);
    return { ok: false, error: "unexpected" };
  }
}
