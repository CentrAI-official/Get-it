import "server-only";
import {
  canSettle,
  checkWindowStart,
  paysToConfirm,
  reminderDay,
  settledKeys,
  type FixedAction,
} from "@/features/budget/checklist";
import {
  currencyOf,
  occurrencesIn,
  type BudgetError,
  type UpcomingItem,
} from "@/features/budget/rules";
import { fromDbDate, minuteOfDay, toCalendarDay, toDbDate } from "@/lib/dates";
import { db } from "@/server/db";
import { notify } from "@/server/notifications/service";
import { loadFixedLog, recurringSelect, toRecurring } from "./service";

// Les paiements fixes à cocher et les paies à confirmer (décision du fondateur,
// 2026-11-10). Payé : une transaction liée au montant fixe et à sa date prévue
// (index unique) ; « pas ce mois-ci » ou pas reçue : une ligne de budget_skips.
// Données privées : chaque fonction filtre sur l'userId de la session.

type Result = { ok: true } | { ok: false; error: BudgetError };

/**
 * Règle un paiement fixe : payé (au montant prévu ou à celui donné, pour cette
 * fois seulement), « pas ce mois-ci », ou de nouveau à payer. Le serveur relit
 * le montant fixe et vérifie que la date en est bien une.
 */
export async function setFixedPayment(
  userId: string,
  input: {
    recurringId: string;
    day: string;
    action: FixedAction;
    amountCents: number | null;
  },
  today: string,
): Promise<Result> {
  const row = await db.budgetRecurring.findFirst({
    where: { id: input.recurringId, userId },
    select: recurringSelect,
  });
  if (!row) return { ok: false, error: "notFound" };
  const rule = toRecurring(row);
  const on = toDbDate(input.day);
  const where = { userId, recurringId: rule.id, recurringOn: on };
  const existing = await db.budgetEntry.findFirst({
    where,
    select: { id: true },
  });
  // Une vraie date du montant fixe (ou un paiement déjà fait), pas trop loin
  if (
    !canSettle(rule, input.day, today) ||
    (!existing && occurrencesIn(rule, input.day, input.day).length === 0)
  ) {
    return { ok: false, error: "dateInvalid" };
  }

  const skip = { recurringId: rule.id, occurredOn: on };
  await db.$transaction(async (tx) => {
    if (input.action !== "paid") {
      await tx.budgetEntry.deleteMany({ where });
      if (input.action === "skipped") {
        await tx.budgetSkip.createMany({
          data: [{ userId, ...skip }],
          skipDuplicates: true,
        });
      } else {
        await tx.budgetSkip.deleteMany({ where: { userId, ...skip } });
      }
      return;
    }
    await tx.budgetSkip.deleteMany({ where: { userId, ...skip } });
    const amountCents = input.amountCents ?? rule.amountCents;
    if (existing) {
      await tx.budgetEntry.update({
        where: { id: existing.id },
        data: { amountCents },
      });
      return;
    }
    // Deux touchers en même temps : l'index unique n'en garde qu'un
    await tx.budgetEntry.createMany({
      data: [
        {
          userId,
          kind: rule.kind,
          category: rule.category,
          amountCents,
          note: rule.label,
          occurredOn: on,
          accountId: rule.accountId,
          toAccountId: rule.toAccountId,
          recurringId: rule.id,
          recurringOn: on,
        },
      ],
      skipDuplicates: true,
    });
  });
  return { ok: true };
}

/**
 * Les paies arrivées à confirmer (la fenêtre qui s'ouvre dans le budget), la
 * plus ancienne d'abord. Seulement les revenus fixes : léger, sans tout le budget.
 */
export async function getPaysToConfirm(userId: string): Promise<{
  pays: UpcomingItem[];
  currency: "CAD" | "USD";
}> {
  const [profile, rows] = await Promise.all([
    db.profile.findUnique({
      where: { id: userId },
      select: { country: true, settings: { select: { timeZone: true } } },
    }),
    db.budgetRecurring.findMany({
      where: { userId, kind: "income" },
      select: recurringSelect,
    }),
  ]);
  const currency = currencyOf(profile?.country ?? null);
  if (rows.length === 0) return { pays: [], currency };
  const today = toCalendarDay(
    new Date(),
    profile?.settings?.timeZone ?? "America/Toronto",
  );
  const log = await loadFixedLog(userId, checkWindowStart(today), today);
  return {
    pays: paysToConfirm(rows.map(toRecurring), settledKeys(log), today),
    currency,
  };
}

export async function setBillReminders(userId: string, enabled: boolean) {
  await db.userSettings.update({
    where: { userId },
    data: { billReminders: enabled },
  });
}

/** Montants fixes relus au plus à chaque passage de la tâche planifiée. */
const REMINDER_RULES_PER_RUN = 5000;

/**
 * Rappel la veille à 9 h (tâche planifiée, toutes les heures) : chaque dépense ou
 * virement fixe qui tombe demain, pas encore coché ni « pas ce mois-ci ». Une
 * seule notification par personne et par jour (regroupée), avec le nom du
 * paiement seulement, jamais le montant. Jamais deux fois le même paiement.
 * `userId` limite le passage à une personne (vérifications de bout en bout : la
 * base est partagée pendant la bêta).
 */
export async function sendBillReminders(
  now = new Date(),
  { userId }: { userId?: string } = {},
) {
  const rows = await db.budgetRecurring.findMany({
    where: {
      ...(userId ? { userId } : {}),
      kind: { in: ["expense", "transfer"] },
      OR: [
        { endsOn: null },
        { endsOn: { gte: toDbDate(now.toISOString().slice(0, 10)) } },
      ],
      profile: { settings: { is: { billReminders: true } } },
    },
    orderBy: { id: "asc" },
    take: REMINDER_RULES_PER_RUN,
    select: {
      id: true,
      userId: true,
      kind: true,
      label: true,
      frequency: true,
      startsOn: true,
      endsOn: true,
      remindedOn: true,
      profile: { select: { settings: { select: { timeZone: true } } } },
    },
  });

  // Ceux qui tombent demain dans le fuseau de la personne, à partir de 9 h
  const due: { id: string; userId: string; label: string; day: string }[] = [];
  for (const row of rows) {
    const timeZone = row.profile.settings?.timeZone ?? "America/Toronto";
    const day = reminderDay(
      {
        kind: row.kind as "expense" | "transfer",
        frequency: row.frequency as UpcomingItem["frequency"],
        startsOn: fromDbDate(row.startsOn),
        endsOn: row.endsOn ? fromDbDate(row.endsOn) : null,
        remindedOn: row.remindedOn ? fromDbDate(row.remindedOn) : null,
      },
      toCalendarDay(now, timeZone),
      Math.floor(minuteOfDay(now, timeZone) / 60),
    );
    if (day)
      due.push({ id: row.id, userId: row.userId, label: row.label, day });
  }
  if (due.length === 0) return { reminded: 0 };

  // Déjà payé d'avance ou « pas ce mois-ci » : pas de rappel
  const [paid, skipped] = await Promise.all([
    db.budgetEntry.findMany({
      where: {
        OR: due.map((item) => ({
          recurringId: item.id,
          recurringOn: toDbDate(item.day),
        })),
      },
      select: { recurringId: true },
    }),
    db.budgetSkip.findMany({
      where: {
        OR: due.map((item) => ({
          recurringId: item.id,
          occurredOn: toDbDate(item.day),
        })),
      },
      select: { recurringId: true },
    }),
  ]);
  const settled = new Set([
    ...paid.map((row) => row.recurringId),
    ...skipped.map((row) => row.recurringId),
  ]);

  let reminded = 0;
  for (const item of due) {
    if (settled.has(item.id)) continue;
    // On réserve le rappel avant de l'envoyer : jamais deux fois
    const { count } = await db.budgetRecurring.updateMany({
      where: {
        id: item.id,
        OR: [{ remindedOn: null }, { remindedOn: { lt: toDbDate(item.day) } }],
      },
      data: { remindedOn: toDbDate(item.day) },
    });
    if (count === 0) continue;
    await notify({
      userId: item.userId,
      kind: "bill_due",
      actorId: null,
      href: "/services/financial/budget",
      subject: item.label,
      groupKey: `bill_due:${item.day}`,
    });
    reminded += 1;
  }
  return { reminded };
}
