import "server-only";
import {
  currencyOf,
  MAX_ENTRIES_PER_DAY,
  MAX_RECURRING,
  monthlyEquivalent,
  nextOccurrence,
  periodOf,
  summarizeBudget,
  type BudgetCategory,
  type BudgetEntryRow,
  type BudgetError,
  type BudgetFrequency,
  type BudgetKind,
  type BudgetRecurringRow,
  type BudgetSummary,
  type BudgetView,
  type EntryInput,
  type RecurringInput,
} from "@/features/budget/rules";
import { fromDbDate, toCalendarDay, toDbDate } from "@/lib/dates";
import { db } from "@/server/db";

// Financier › Budget. Données privées (Loi 25) : chaque fonction reçoit
// l'userId de la session et filtre dessus ; rien n'est montré aux autres
// membres ni envoyé à Get iT AI. Effacé avec le compte (onDelete: Cascade).

export type BudgetPage = {
  currency: "CAD" | "USD";
  today: string;
  view: BudgetView;
  /** Premier et dernier jour de la période affichée. */
  start: string;
  end: string;
  summary: BudgetSummary;
  /** Mouvements de la période, le plus récent d'abord. */
  entries: BudgetEntryRow[];
  /** Revenus puis dépenses fixes, avec leur prochaine date. */
  recurring: (BudgetRecurringRow & {
    next: string | null;
    monthlyCents: number;
  })[];
  /** Rien n'a encore été entré (premier passage). */
  empty: boolean;
};

const recurringSelect = {
  id: true,
  kind: true,
  label: true,
  category: true,
  amountCents: true,
  frequency: true,
  startsOn: true,
  endsOn: true,
} as const;

const entrySelect = {
  id: true,
  kind: true,
  category: true,
  amountCents: true,
  note: true,
  occurredOn: true,
} as const;

// Les colonnes texte sont bornées par les contraintes de la migration
function toRecurring(row: {
  id: string;
  kind: string;
  label: string;
  category: string | null;
  amountCents: number;
  frequency: string;
  startsOn: Date;
  endsOn: Date | null;
}): BudgetRecurringRow {
  return {
    ...row,
    kind: row.kind as BudgetKind,
    category: row.category as BudgetCategory | null,
    frequency: row.frequency as BudgetFrequency,
    startsOn: fromDbDate(row.startsOn),
    endsOn: row.endsOn ? fromDbDate(row.endsOn) : null,
  };
}

function toEntry(row: {
  id: string;
  kind: string;
  category: string | null;
  amountCents: number;
  note: string | null;
  occurredOn: Date;
}): BudgetEntryRow {
  return {
    ...row,
    kind: row.kind as BudgetKind,
    category: row.category as BudgetCategory | null,
    occurredOn: fromDbDate(row.occurredOn),
  };
}

/** Le budget d'une période (jour, semaine ou mois) qui contient `day`. */
export async function getBudget(
  userId: string,
  input: { view: BudgetView; day: string | null },
): Promise<BudgetPage> {
  const profile = await db.profile.findUnique({
    where: { id: userId },
    select: { country: true, settings: { select: { timeZone: true } } },
  });
  const today = toCalendarDay(
    new Date(),
    profile?.settings?.timeZone ?? "America/Toronto",
  );
  const { start, end } = periodOf(input.view, input.day ?? today);

  const [recurringRows, entryRows, anyEntry] = await Promise.all([
    db.budgetRecurring.findMany({
      where: { userId },
      orderBy: [{ kind: "desc" }, { amountCents: "desc" }],
      take: MAX_RECURRING,
      select: recurringSelect,
    }),
    db.budgetEntry.findMany({
      where: {
        userId,
        occurredOn: { gte: toDbDate(start), lte: toDbDate(end) },
      },
      orderBy: [{ occurredOn: "desc" }, { createdAt: "desc" }],
      select: entrySelect,
    }),
    db.budgetEntry.findFirst({ where: { userId }, select: { id: true } }),
  ]);
  const recurring = recurringRows.map(toRecurring);
  const entries = entryRows.map(toEntry);

  return {
    currency: currencyOf(profile?.country ?? null),
    today,
    view: input.view,
    start,
    end,
    summary: summarizeBudget({ entries, recurring, start, end, today }),
    entries,
    recurring: recurring.map((rule) => ({
      ...rule,
      next: nextOccurrence(rule, today),
      monthlyCents: monthlyEquivalent(rule),
    })),
    empty: recurring.length === 0 && anyEntry === null,
  };
}

type Result = { ok: true } | { ok: false; error: BudgetError };

/** Seulement les colonnes du mouvement. */
const entryData = (input: EntryInput) => ({
  kind: input.kind,
  category: input.category,
  amountCents: input.amountCents,
  note: input.note,
  occurredOn: toDbDate(input.occurredOn),
});

const recurringData = (input: RecurringInput) => ({
  kind: input.kind,
  label: input.label,
  category: input.category,
  amountCents: input.amountCents,
  frequency: input.frequency,
  startsOn: toDbDate(input.startsOn),
  endsOn: input.endsOn ? toDbDate(input.endsOn) : null,
});

/** Ajoute (`entryId` null) ou modifie une dépense ou un revenu au jour le jour. */
export async function saveEntry(
  userId: string,
  entryId: string | null,
  input: EntryInput,
): Promise<Result> {
  if (entryId) {
    const { count } = await db.budgetEntry.updateMany({
      where: { id: entryId, userId },
      data: entryData(input),
    });
    return count > 0 ? { ok: true } : { ok: false, error: "notFound" };
  }
  const recent = await db.budgetEntry.count({
    where: {
      userId,
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60_000) },
    },
  });
  if (recent >= MAX_ENTRIES_PER_DAY) return { ok: false, error: "entryLimit" };
  await db.budgetEntry.create({ data: { userId, ...entryData(input) } });
  return { ok: true };
}

export async function deleteEntry(userId: string, entryId: string) {
  const { count } = await db.budgetEntry.deleteMany({
    where: { id: entryId, userId },
  });
  return count > 0;
}

/** Ajoute (`recurringId` null) ou modifie un revenu ou une dépense fixe. */
export async function saveRecurring(
  userId: string,
  recurringId: string | null,
  input: RecurringInput,
): Promise<Result> {
  if (recurringId) {
    const { count } = await db.budgetRecurring.updateMany({
      where: { id: recurringId, userId },
      data: recurringData(input),
    });
    return count > 0 ? { ok: true } : { ok: false, error: "notFound" };
  }
  const count = await db.budgetRecurring.count({ where: { userId } });
  if (count >= MAX_RECURRING) return { ok: false, error: "recurringLimit" };
  await db.budgetRecurring.create({
    data: { userId, ...recurringData(input) },
  });
  return { ok: true };
}

export async function deleteRecurring(userId: string, recurringId: string) {
  const { count } = await db.budgetRecurring.deleteMany({
    where: { id: recurringId, userId },
  });
  return count > 0;
}

/** « Effacer mon budget » : tous les mouvements, revenus et dépenses fixes. */
export async function eraseBudget(userId: string) {
  await db.$transaction([
    db.budgetEntry.deleteMany({ where: { userId } }),
    db.budgetRecurring.deleteMany({ where: { userId } }),
  ]);
}
