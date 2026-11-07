import { groupOf, type CategoryInfo } from "./categories";
import type { MonthRollup } from "./plan";

// Les rapports du budget : d'où vient l'argent, où il va, et comment ça évolue.
// Fonctions pures.

export const REPORT_RANGES = [3, 6, 12] as const;
export type ReportRange = (typeof REPORT_RANGES)[number];

/** Plage lue dans l'adresse (?range=), 6 mois par défaut. */
export function parseRange(value: unknown): ReportRange {
  return REPORT_RANGES.find((range) => String(range) === value) ?? 6;
}

/** Le mois (« AAAA-MM ») décalé de `months` mois. */
export function shiftMonthKey(month: string, months: number) {
  const date = new Date(
    Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + months),
  );
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Les `count` derniers mois jusqu'à `last`, du plus ancien au plus récent. */
export function monthsUntil(last: string, count: number) {
  return Array.from({ length: count }, (_, index) =>
    shiftMonthKey(last, index - count + 1),
  );
}

export type CashFlowPoint = {
  month: string;
  incomeCents: number;
  spentCents: number;
  savedCents: number;
  /** Ce qui reste après les dépenses et l'épargne. */
  netCents: number;
};

/** Ce qui entre et ce qui sort, mois par mois. */
export function cashFlow(
  rollups: ReadonlyMap<string, MonthRollup>,
  months: readonly string[],
): CashFlowPoint[] {
  return months.map((month) => {
    const rollup = rollups.get(month);
    const incomeCents = rollup?.incomeCents ?? 0;
    const spentCents = rollup?.spentCents ?? 0;
    const savedCents = rollup?.savedCents ?? 0;
    return {
      month,
      incomeCents,
      spentCents,
      savedCents,
      netCents: incomeCents - spentCents - savedCents,
    };
  });
}

/** Le taux d'épargne d'une période : la part des revenus mise de côté ; null sans revenu. */
export function savingsRate(points: readonly CashFlowPoint[]) {
  const income = points.reduce((sum, point) => sum + point.incomeCents, 0);
  if (income <= 0) return null;
  const saved = points.reduce((sum, point) => sum + point.savedCents, 0);
  return Math.round((saved / income) * 100);
}

export type CategoryTrend = {
  key: string;
  cents: number;
  /** Moyenne des mois d'avant où il y a eu des dépenses ; null sans historique. */
  averageCents: number | null;
};

/** Où va l'argent ce mois-ci, comparé à la moyenne des `lookback` mois d'avant. */
export function categoryTrends(
  rollups: ReadonlyMap<string, MonthRollup>,
  month: string,
  lookback = 3,
): CategoryTrend[] {
  const current = rollups.get(month)?.categories;
  if (!current) return [];
  const before = Array.from({ length: lookback }, (_, index) =>
    rollups.get(shiftMonthKey(month, -index - 1)),
  ).filter((rollup) => rollup !== undefined);
  return [...current.entries()]
    .filter(([key, line]) => line.cents > 0 && key !== "savings")
    .map(([key, line]) => {
      const past = before.map(
        (rollup) => rollup.categories.get(key)?.cents ?? 0,
      );
      return {
        key,
        cents: line.cents,
        averageCents:
          past.length > 0
            ? Math.round(
                past.reduce((sum, cents) => sum + cents, 0) / past.length,
              )
            : null,
      };
    })
    .sort((a, b) => b.cents - a.cents);
}

/** La répartition réelle des revenus, à côté du repère 50/30/20. */
export function groupShares(
  points: readonly {
    rollup: MonthRollup | undefined;
  }[],
  categories: readonly CategoryInfo[],
) {
  const totals = { needs: 0, wants: 0, savings: 0 };
  let income = 0;
  for (const { rollup } of points) {
    if (!rollup) continue;
    income += rollup.incomeCents;
    for (const [key, line] of rollup.categories) {
      totals[groupOf(key, categories)] += line.cents;
    }
  }
  const share = (cents: number) =>
    income > 0 ? Math.round((cents / income) * 100) : null;
  return {
    incomeCents: income,
    needs: { cents: totals.needs, percent: share(totals.needs), target: 50 },
    wants: { cents: totals.wants, percent: share(totals.wants), target: 30 },
    savings: {
      cents: totals.savings,
      percent: share(totals.savings),
      target: 20,
    },
  };
}
