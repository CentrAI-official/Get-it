import "server-only";
import { z } from "zod";
import { weekOf } from "@/features/development/calendar";
import {
  storedPlanSchema,
  type DevelopmentPlan,
} from "@/features/development/plan";
import {
  currencyOf,
  parseAmount,
  BUDGET_NOTE_MAX,
} from "@/features/budget/rules";
import {
  PLAN_LOG_DAYS_BACK,
  PLAN_LOG_LIMITS,
  type LoggedKind,
  type PlanBudgetTarget,
  type PlanLogError,
  type PlanLogInput,
  type PlanLogPage,
} from "@/features/plan-logs/rules";
import { daysBetween, fromDbDate, toCalendarDay, toDbDate } from "@/lib/dates";
import { deleteEntry, saveEntry } from "@/server/budget/service";
import { db } from "@/server/db";
import { getUserTimeZone } from "@/server/profile/service";

// Éléments cochés des plans. Données privées : chaque fonction reçoit l'userId
// de la session et filtre dessus ; rien n'est montré aux autres membres ni
// envoyé à Get iT AI. Effacés avec le compte (onDelete: Cascade). Le serveur
// relit l'élément dans le plan, jamais dans ce que le navigateur envoie.

const uuid = z.uuid();

export type PlanLogResult = { ok: true } | { ok: false; error: PlanLogError };

/** Pour la page d'un plan : les éléments cochés de la semaine en cours. */
export async function getPlanLogPage(
  userId: string,
  kind: LoggedKind,
  plan: DevelopmentPlan,
): Promise<PlanLogPage> {
  const profile = await db.profile.findUnique({
    where: { id: userId },
    select: { country: true, settings: { select: { timeZone: true } } },
  });
  const today = toCalendarDay(
    new Date(),
    profile?.settings?.timeZone ?? "America/Toronto",
  );
  const days = weekOf(today);
  const refs =
    kind === "mental"
      ? plan.schedule
          .flatMap((session) => session.items.map((item) => item.ref))
          .filter((ref): ref is string => uuid.safeParse(ref).success)
      : [];
  const [rows, items] = await Promise.all([
    db.planItemLog.findMany({
      where: {
        userId,
        kind,
        day: {
          gte: toDbDate(days[0] ?? today),
          lte: toDbDate(days[6] ?? today),
        },
      },
      select: {
        day: true,
        weekday: true,
        position: true,
        item: true,
        replacedBy: true,
        outcome: true,
        budgetEntry: { select: { amountCents: true } },
      },
    }),
    refs.length > 0
      ? db.libraryItem.findMany({
          where: { id: { in: refs } },
          select: { id: true, minutes: true },
        })
      : [],
  ]);
  return {
    rows: rows.map(({ budgetEntry, ...row }) => ({
      ...row,
      day: fromDbDate(row.day),
      budgetCents: budgetEntry?.amountCents ?? null,
    })),
    currency: currencyOf(profile?.country ?? null),
    minutes: Object.fromEntries(
      items.flatMap((item) =>
        item.minutes ? [[item.id, item.minutes] as const] : [],
      ),
    ),
  };
}

/** L'élément dans le plan enregistré ; le jour doit être possible. */
async function resolveItem(
  userId: string,
  input: { kind: LoggedKind; day: string; weekday: number; position: number },
) {
  const today = toCalendarDay(new Date(), await getUserTimeZone(userId));
  const age = daysBetween(input.day, today);
  if (age < 0 || age > PLAN_LOG_DAYS_BACK) {
    return { error: "dayInvalid" as const };
  }
  const row = await db.developmentPlan.findUnique({
    where: { userId_kind: { userId, kind: input.kind } },
    select: { id: true, plan: true },
  });
  const plan = row ? storedPlanSchema.safeParse(row.plan) : null;
  const item = plan?.success
    ? plan.data.schedule.find((session) => session.weekday === input.weekday)
        ?.items[input.position]
    : null;
  if (!row || !item) return { error: "notFound" as const };
  return { planId: row.id, item };
}

const logKey = (
  userId: string,
  input: { kind: LoggedKind; day: string; weekday: number; position: number },
) => ({
  userId_kind_day_weekday_position: {
    userId,
    kind: input.kind,
    day: toDbDate(input.day),
    weekday: input.weekday,
    position: input.position,
  },
});

/**
 * Coche, précise ou décoche un élément. Renvoyer deux fois la même chose ne
 * change rien. Décocher retire aussi ce que l'élément avait ajouté au budget.
 */
export async function setPlanItem(
  userId: string,
  input: PlanLogInput,
): Promise<PlanLogResult> {
  const where = logKey(userId, input);
  if (!input.done) {
    const existing = await db.planItemLog.findUnique({
      where,
      select: { budgetEntryId: true },
    });
    if (!existing) return { ok: true };
    await db.$transaction(async (tx) => {
      await tx.planItemLog.deleteMany({
        where: where.userId_kind_day_weekday_position,
      });
      if (existing.budgetEntryId) {
        await tx.budgetEntry.deleteMany({
          where: { id: existing.budgetEntryId, userId },
        });
      }
    });
    return { ok: true };
  }

  const resolved = await resolveItem(userId, input);
  if (resolved.error) return { ok: false, error: resolved.error };
  const values = {
    planId: resolved.planId,
    item: resolved.item.name.slice(0, PLAN_LOG_LIMITS.item),
    // Chaque précision n'a de sens que pour son type de plan
    replacedBy: input.kind === "nutrition" ? input.replacedBy : null,
    outcome: input.kind === "social" ? input.outcome : null,
  };
  await db.planItemLog.upsert({
    where,
    update: values,
    create: {
      userId,
      kind: input.kind,
      day: toDbDate(input.day),
      weekday: input.weekday,
      position: input.position,
      ...values,
    },
  });
  return { ok: true };
}

/**
 * Le virement d'épargne fait va dans le budget (catégorie Épargne, au jour de
 * l'élément), seulement sur le clic de la personne. L'élément doit être coché.
 */
export async function addPlanItemToBudget(
  userId: string,
  input: PlanBudgetTarget & { amount: string },
): Promise<PlanLogResult> {
  const amountCents = parseAmount(input.amount);
  if (amountCents === null) return { ok: false, error: "amountInvalid" };
  const where = logKey(userId, input);
  const log = await db.planItemLog.findUnique({
    where,
    select: { id: true, item: true, budgetEntryId: true },
  });
  if (!log) return { ok: false, error: "notFound" };
  if (log.budgetEntryId) return { ok: true };

  const saved = await saveEntry(userId, null, {
    kind: "expense",
    category: "savings",
    amountCents,
    note: log.item.slice(0, BUDGET_NOTE_MAX),
    occurredOn: input.day,
    accountId: null,
    toAccountId: null,
    goalId: null,
  });
  if (!saved.ok) {
    return {
      ok: false,
      error: saved.error === "entryLimit" ? "entryLimit" : "unexpected",
    };
  }
  // Deux envois en même temps : un seul garde sa ligne de budget
  const { count } = await db.planItemLog.updateMany({
    where: { id: log.id, userId, budgetEntryId: null },
    data: { budgetEntryId: saved.id },
  });
  if (count === 0) await deleteEntry(userId, saved.id);
  return { ok: true };
}

/** Retire du budget ce que l'élément y avait ajouté ; il reste coché. */
export async function removePlanItemFromBudget(
  userId: string,
  input: PlanBudgetTarget,
): Promise<PlanLogResult> {
  const log = await db.planItemLog.findUnique({
    where: logKey(userId, input),
    select: { budgetEntryId: true },
  });
  if (!log) return { ok: false, error: "notFound" };
  // La ligne de l'élément se détache seule (onDelete: SetNull)
  if (log.budgetEntryId) await deleteEntry(userId, log.budgetEntryId);
  return { ok: true };
}
