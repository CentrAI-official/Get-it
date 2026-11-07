import "server-only";
import { createHash } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { isBuiltInCategory } from "@/features/budget/categories";
import {
  importIdentity,
  MAX_IMPORT_ROWS_PER_DAY,
  normalizeDescription,
  withOccurrences,
  type ImportInput,
} from "@/features/budget/import";
import {
  monthsUntil,
  shiftMonthKey,
  type ReportRange,
} from "@/features/budget/reports";
import type { TransactionFilters } from "@/features/budget/filters";
import { rollupMonths } from "@/features/budget/plan";
import {
  budgetEffect,
  monthStart,
  periodOf,
  upcomingIn,
  type BudgetEntryRow,
  type BudgetError,
  type UpcomingItem,
} from "@/features/budget/rules";
import { fromDbDate, toDbDate } from "@/lib/dates";
import { db } from "@/server/db";
import { entrySelect, getBudgetBase, monthlyRows, toEntry } from "./service";

// Les transactions (recherche, import, export), les factures et les rapports.
// Chaque fonction reçoit l'userId de la session.

/** Ce que les filtres demandent à la base. */
function whereOf(
  userId: string,
  filters: TransactionFilters,
): Prisma.BudgetEntryWhereInput {
  const { start, end } = filters.month
    ? periodOf("month", `${filters.month}-01`)
    : { start: null, end: null };
  return {
    userId,
    ...(start && end
      ? { occurredOn: { gte: toDbDate(start), lte: toDbDate(end) } }
      : {}),
    ...(filters.q
      ? { note: { contains: filters.q, mode: "insensitive" as const } }
      : {}),
    ...(filters.category ? { category: filters.category } : {}),
    ...(filters.type ? { kind: filters.type } : {}),
    ...(filters.account
      ? {
          OR: [
            { accountId: filters.account },
            { toAccountId: filters.account },
          ],
        }
      : {}),
  };
}

export type TransactionsPage = Awaited<ReturnType<typeof getBudgetBase>> & {
  entries: BudgetEntryRow[];
  /** Toutes les transactions qui correspondent aux filtres. */
  total: number;
  incomeCents: number;
  spentCents: number;
};

export async function getTransactions(
  userId: string,
  filters: TransactionFilters,
): Promise<TransactionsPage> {
  const base = await getBudgetBase(userId);
  const where = whereOf(userId, filters);
  const [rows, totals] = await Promise.all([
    db.budgetEntry.findMany({
      where,
      orderBy: [{ occurredOn: "desc" }, { createdAt: "desc" }],
      take: filters.limit,
      select: entrySelect,
    }),
    db.budgetEntry.groupBy({
      by: ["kind", "category", "accountId", "toAccountId"],
      where,
      _sum: { amountCents: true },
      _count: { _all: true },
    }),
  ]);
  let total = 0;
  let incomeCents = 0;
  let spentCents = 0;
  for (const row of totals) {
    total += row._count._all;
    const effect = budgetEffect(
      {
        kind: row.kind as BudgetEntryRow["kind"],
        category: row.category,
        amountCents: row._sum.amountCents ?? 0,
        accountId: row.accountId,
        toAccountId: row.toAccountId,
      },
      base.types,
    );
    incomeCents += effect.income;
    spentCents += effect.spent;
  }
  return {
    ...base,
    entries: rows.map(toEntry),
    total,
    incomeCents,
    spentCents,
  };
}

/** Commerçant → dernière catégorie choisie : l'import s'en souvient. */
export async function getImportHistory(userId: string) {
  const rows = await db.budgetEntry.findMany({
    where: { userId, kind: "expense", note: { not: null } },
    orderBy: { occurredOn: "desc" },
    take: 2000,
    select: { note: true, category: true },
  });
  const history: Record<string, string> = {};
  for (const row of rows) {
    if (!row.note || !row.category) continue;
    const key = normalizeDescription(row.note);
    if (key && !history[key]) history[key] = row.category;
  }
  return history;
}

/**
 * Importe les lignes retenues d'un relevé. Une ligne déjà importée est ignorée
 * (son empreinte existe déjà) : importer deux fois le même fichier n'ajoute rien.
 */
export async function importEntries(
  userId: string,
  input: ImportInput,
): Promise<
  | { ok: true; added: number; skipped: number }
  | { ok: false; error: BudgetError }
> {
  if (input.accountId) {
    const owned = await db.budgetAccount.count({
      where: { id: input.accountId, userId },
    });
    if (owned === 0) return { ok: false, error: "notFound" };
  }
  const custom = [
    ...new Set(
      input.rows
        .map((row) => row.category)
        .filter((key) => !isBuiltInCategory(key)),
    ),
  ];
  if (custom.length > 0) {
    const owned = await db.budgetCategorySetting.count({
      where: { userId, key: { in: custom }, name: { not: null } },
    });
    if (owned !== custom.length) return { ok: false, error: "notFound" };
  }
  const recent = await db.budgetEntry.count({
    where: {
      userId,
      importKey: { not: null },
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60_000) },
    },
  });
  if (recent + input.rows.length > MAX_IMPORT_ROWS_PER_DAY) {
    return { ok: false, error: "importLimit" };
  }

  const { count } = await db.budgetEntry.createMany({
    data: withOccurrences(input.rows).map(({ row, occurrence }) => ({
      userId,
      kind: row.cents < 0 ? "expense" : "income",
      category: row.cents < 0 ? row.category : null,
      amountCents: Math.abs(row.cents),
      note: row.description || null,
      occurredOn: toDbDate(row.date),
      accountId: input.accountId,
      importKey: createHash("sha256")
        .update(importIdentity(input.accountId, row, occurrence))
        .digest("hex"),
    })),
    skipDuplicates: true,
  });
  return { ok: true, added: count, skipped: input.rows.length - count };
}

/** Tout le budget, pour « Exporter » (droit à la portabilité, Loi 25). */
export async function exportEntries(userId: string) {
  const rows = await db.budgetEntry.findMany({
    where: { userId },
    orderBy: [{ occurredOn: "desc" }, { createdAt: "desc" }],
    take: 20_000,
    select: {
      occurredOn: true,
      kind: true,
      category: true,
      note: true,
      amountCents: true,
      account: { select: { name: true } },
      toAccount: { select: { name: true } },
    },
  });
  return rows.map((row) => ({
    date: fromDbDate(row.occurredOn),
    kind: row.kind as BudgetEntryRow["kind"],
    category: row.category,
    note: row.note,
    amountCents: row.amountCents,
    account: row.account?.name ?? null,
    toAccount: row.toAccount?.name ?? null,
  }));
}

export type BillDay = {
  day: string;
  label: string;
  amountCents: number;
  kind: UpcomingItem["kind"] | BudgetEntryRow["kind"];
  category: string | null;
  /** Déjà inscrit dans les transactions. */
  paid: boolean;
};

export type BillsPage = Awaited<ReturnType<typeof getBudgetBase>> & {
  month: string;
  /** Tout ce qui tombe ce mois-là : payé ou à venir. */
  bills: BillDay[];
  /** À venir dans les 30 prochains jours. */
  next30: UpcomingItem[];
};

/** Les paiements fixes d'un mois, pour le calendrier des factures. */
export async function getBills(
  userId: string,
  day: string | null,
): Promise<BillsPage> {
  const base = await getBudgetBase(userId);
  const month = monthStart(day ?? base.today);
  const { start, end } = periodOf("month", month);
  const posted = await db.budgetEntry.findMany({
    where: {
      userId,
      recurringId: { not: null },
      occurredOn: { gte: toDbDate(start), lte: toDbDate(end) },
    },
    select: {
      occurredOn: true,
      note: true,
      amountCents: true,
      kind: true,
      category: true,
    },
  });
  const upcoming = upcomingIn(base.rules, start, end, base.today);
  const bills: BillDay[] = [
    ...posted.map((row) => ({
      day: fromDbDate(row.occurredOn),
      label: row.note ?? "",
      amountCents: row.amountCents,
      kind: row.kind as BudgetEntryRow["kind"],
      category: row.category,
      paid: true,
    })),
    ...upcoming.map((item) => ({
      day: item.day,
      label: item.label,
      amountCents: item.amountCents,
      kind: item.kind,
      category: item.category,
      paid: false,
    })),
  ].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
  const horizon = new Date(`${base.today}T00:00:00Z`);
  horizon.setUTCDate(horizon.getUTCDate() + 30);
  return {
    ...base,
    month,
    bills,
    next30: upcomingIn(
      base.rules,
      base.today,
      horizon.toISOString().slice(0, 10),
      base.today,
    ),
  };
}

/** Les chiffres des rapports : les mois demandés, et 3 de plus pour comparer. */
export async function getReports(userId: string, range: ReportRange) {
  const base = await getBudgetBase(userId);
  const last = base.today.slice(0, 7);
  const months = monthsUntil(last, range);
  const first = shiftMonthKey(months[0] ?? last, -3);
  const rows = await monthlyRows(
    userId,
    `${first}-01`,
    periodOf("month", `${last}-01`).end,
  );
  const biggest = await db.budgetEntry.findMany({
    where: {
      userId,
      kind: "expense",
      NOT: { category: "savings" },
      occurredOn: {
        gte: toDbDate(`${months[0] ?? last}-01`),
        lte: toDbDate(periodOf("month", `${last}-01`).end),
      },
    },
    orderBy: { amountCents: "desc" },
    take: 5,
    select: entrySelect,
  });
  return {
    ...base,
    months,
    rollups: rollupMonths(rows, base.types),
    biggest: biggest.map(toEntry),
  };
}
