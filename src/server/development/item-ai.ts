import "server-only";
import { asDayMoment } from "@/config/moments";
import {
  itemEditInstructions,
  itemEditPrompt,
  normalizeItemEdit,
  type ItemAiCurrent,
  type ItemEditSuggestion,
} from "@/features/development/item-ai";
import { storedPlanSchema } from "@/features/development/plan";
import type { DevelopmentKind } from "@/features/development/questionnaires";
import { fromDbDate, toCalendarDay } from "@/lib/dates";
import { getAiProvider } from "@/server/ai/provider";
import {
  getAiProfile,
  recordAiUsage,
  releaseAiRequest,
  reserveAiRequest,
} from "@/server/ai/usage";
import { db } from "@/server/db";

export type ItemAiError =
  | "notConfigured"
  | "consentRequired"
  | "notFound"
  | "limitReached"
  | "refused"
  | "unexpected";

export type ItemAiTarget =
  | { type: "task" | "habit"; id: string }
  | { type: "session"; kind: DevelopmentKind; weekday: number };

/** L'élément tel qu'il est en base (jamais tel que le navigateur le décrit). */
async function currentItem(
  userId: string,
  target: ItemAiTarget,
): Promise<ItemAiCurrent | null> {
  const empty = { dueDate: null, weekdays: [], weekday: null, plan: null };
  if (target.type === "task") {
    const task = await db.task.findFirst({
      where: { id: target.id, userId },
      select: { title: true, dueDate: true, timeMinute: true, moment: true },
    });
    return task
      ? {
          ...empty,
          type: "task",
          title: task.title,
          time: task.timeMinute,
          moment: task.moment,
          dueDate: task.dueDate ? fromDbDate(task.dueDate) : null,
        }
      : null;
  }
  if (target.type === "habit") {
    const habit = await db.habit.findFirst({
      where: { id: target.id, userId },
      select: { title: true, weekdays: true, timeMinute: true, moment: true },
    });
    return habit
      ? {
          ...empty,
          type: "habit",
          title: habit.title,
          time: habit.timeMinute,
          moment: habit.moment,
          weekdays: habit.weekdays,
        }
      : null;
  }
  if (target.type !== "session") return null;
  const row = await db.developmentPlan.findUnique({
    where: { userId_kind: { userId, kind: target.kind } },
    select: { plan: true },
  });
  const stored = row ? storedPlanSchema.safeParse(row.plan) : null;
  const session = stored?.success
    ? stored.data.schedule.find((entry) => entry.weekday === target.weekday)
    : undefined;
  return stored?.success && session
    ? {
        ...empty,
        type: "session",
        title: session.title,
        time: session.time,
        moment: asDayMoment(session.moment),
        weekday: session.weekday,
        plan: stored.data.title,
      }
    : null;
}

/**
 * « Modifier avec Get iT AI » : les nouveaux champs d'un élément, d'après la
 * demande de la personne. Rien n'est enregistré ici : le formulaire est
 * rempli, puis la personne vérifie et enregistre. Compte comme une requête.
 */
export async function suggestItemEdit(
  userId: string,
  target: ItemAiTarget,
  request: string,
): Promise<
  | { ok: true; suggestion: ItemEditSuggestion; remaining: number }
  | { ok: false; error: ItemAiError }
> {
  const provider = getAiProvider();
  if (!provider) return { ok: false, error: "notConfigured" };
  const profile = await getAiProfile(userId);
  if (!profile) return { ok: false, error: "notFound" };
  if (!profile.consented) return { ok: false, error: "consentRequired" };
  const current = await currentItem(userId, target);
  if (!current) return { ok: false, error: "notFound" };

  const reservation = await reserveAiRequest(
    userId,
    "item_edit",
    profile.timeZone,
  );
  if (!reservation) return { ok: false, error: "limitReached" };
  const today = toCalendarDay(new Date(), profile.timeZone);
  const result = await provider
    .suggestItemEdit({
      system: itemEditInstructions(profile.locale),
      prompt: itemEditPrompt(current, request, today),
    })
    .catch(async (error: unknown) => {
      await releaseAiRequest(reservation.id).catch(() => {});
      throw error;
    });
  await recordAiUsage(reservation.id, result.usage);
  if (result.refused) return { ok: false, error: "refused" };
  if (!result.edit) return { ok: false, error: "unexpected" };
  return {
    ok: true,
    suggestion: normalizeItemEdit(result.edit, current),
    remaining: reservation.remaining,
  };
}
