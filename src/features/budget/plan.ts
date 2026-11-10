import { daysBetween } from "@/lib/dates";
import {
  BUDGET_GROUPS,
  type BudgetGroup,
  type CategoryInfo,
} from "./categories";
import {
  budgetEffect,
  monthlyEquivalent,
  monthStart,
  periodOf,
  type AccountTypes,
  type BudgetRecurringRow,
  type EntryKind,
  type UpcomingItem,
} from "./rules";

// Le plan du mois (décision du fondateur, 2026-11-04) : un montant prévu par
// catégorie, ce qui est sorti, ce qui s'en vient et ce qui reste. Un montant vaut
// jusqu'au prochain changement ; sans montant choisi, une catégorie prévoit ses
// paiements fixes. Fonctions pures.

/** Un montant prévu, à partir de `month` (son 1er jour). */
export type PlanRow = { category: string; month: string; amountCents: number };

/** Les transactions d'un mois (« AAAA-MM »), additionnées. */
export type MonthlyRow = {
  month: string;
  kind: EntryKind;
  category: string | null;
  accountId: string | null;
  toAccountId: string | null;
  /** Vient d'un montant fixe. */
  fixed: boolean;
  cents: number;
};

export type MonthRollup = {
  incomeCents: number;
  spentCents: number;
  savedCents: number;
  categories: Map<string, { cents: number; fixedCents: number }>;
};

/** Additionne chaque mois, selon l'effet de chaque transaction sur le budget. */
export function rollupMonths(
  rows: readonly MonthlyRow[],
  types: AccountTypes,
): Map<string, MonthRollup> {
  const months = new Map<string, MonthRollup>();
  for (const row of rows) {
    const rollup = months.get(row.month) ?? {
      incomeCents: 0,
      spentCents: 0,
      savedCents: 0,
      categories: new Map(),
    };
    months.set(row.month, rollup);
    const effect = budgetEffect(
      {
        kind: row.kind,
        category: row.category,
        amountCents: row.cents,
        accountId: row.accountId,
        toAccountId: row.toAccountId,
      },
      types,
    );
    rollup.incomeCents += effect.income;
    rollup.spentCents += effect.spent;
    rollup.savedCents += effect.saved;
    if (effect.category && (effect.spent !== 0 || effect.saved !== 0)) {
      const line = rollup.categories.get(effect.category) ?? {
        cents: 0,
        fixedCents: 0,
      };
      const cents = effect.spent + effect.saved;
      line.cents += cents;
      if (row.fixed) line.fixedCents += cents;
      rollup.categories.set(effect.category, line);
    }
  }
  return months;
}

/** Le montant choisi pour une catégorie ce mois-là ; null si rien n'a été choisi. */
export function plannedFor(
  rows: readonly PlanRow[],
  category: string,
  month: string,
): number | null {
  let found: PlanRow | null = null;
  for (const row of rows) {
    if (row.category !== category || row.month > month) continue;
    if (!found || row.month > found.month) found = row;
  }
  return found?.amountCents ?? null;
}

const nextMonth = (month: string) => monthStart(month, 1);

/**
 * Ce que le report amène au début de `month` : chaque mois depuis `from`, ce qui
 * était prévu moins ce qui est sorti. Un dépassement réduit le mois suivant.
 */
export function carryFor(
  key: string,
  from: string,
  month: string,
  plans: readonly PlanRow[],
  rollups: ReadonlyMap<string, MonthRollup>,
) {
  let carry = 0;
  for (let current = from; current < month; current = nextMonth(current)) {
    const line = rollups.get(current.slice(0, 7))?.categories.get(key);
    const planned = plannedFor(plans, key, current) ?? line?.fixedCents ?? 0;
    carry += planned - (line?.cents ?? 0);
  }
  return carry;
}

export type PlanLine = {
  key: string;
  group: BudgetGroup;
  /** Le montant prévu ce mois-ci. */
  plannedCents: number;
  /** Choisi par la personne ; sinon, ses paiements fixes. */
  explicit: boolean;
  /** Déjà sorti (ou mis de côté pour l'épargne). */
  spentCents: number;
  /** Paiements fixes encore à venir ce mois-ci. */
  upcomingCents: number;
  /** Ce que le report amène des mois passés. */
  carryCents: number;
  /** Ce qui reste : prévu + report − sorti − à venir. */
  availableCents: number;
  rollover: boolean;
  /** Dépenses au jour le jour : la barre montre le temps écoulé du mois. */
  variable: boolean;
};

export type MonthPlan = {
  groups: {
    group: BudgetGroup;
    lines: PlanLine[];
    plannedCents: number;
    usedCents: number;
  }[];
  plannedCents: number;
  /** Revenus reçus et à venir ce mois-ci. */
  expectedIncomeCents: number;
  /**
   * Ce qui n'a pas encore de job : revenus prévus, moins montants prévus, moins
   * les minimums des dettes que le plan ne prévoit pas encore.
   */
  toAssignCents: number;
  /**
   * Les paiements minimums des dettes au-delà de la catégorie Dettes : le
   * paiement d'une carte de crédit n'y compte pas (ses achats ont déjà compté),
   * mais l'argent doit être là (décision du fondateur, 2026-11-10 : « À répartir »
   * et le plan d'argent disent la même chose).
   */
  minimumsReserveCents: number;
  /** L'épargne prévue pas encore mise de côté : elle n'est pas à dépenser. */
  reserveCents: number;
};

/** Le plan d'un mois (`month` : son 1er jour). */
export function buildMonthPlan({
  month,
  categories,
  plans,
  rollups,
  upcoming,
  rollovers,
  types,
  minimumsCents = 0,
}: {
  month: string;
  categories: readonly CategoryInfo[];
  plans: readonly PlanRow[];
  rollups: ReadonlyMap<string, MonthRollup>;
  upcoming: readonly UpcomingItem[];
  /** Catégorie → mois où son report commence. */
  rollovers: ReadonlyMap<string, string>;
  types: AccountTypes;
  /** Les paiements minimums des dettes qui ont encore un solde. */
  minimumsCents?: number;
}): MonthPlan {
  const rollup = rollups.get(month.slice(0, 7));
  const upcomingBy = new Map<string, number>();
  let upcomingIncome = 0;
  for (const item of upcoming) {
    const effect = budgetEffect(item, types);
    upcomingIncome += effect.income;
    const cents = effect.spent + effect.saved;
    if (effect.category && cents !== 0) {
      upcomingBy.set(
        effect.category,
        (upcomingBy.get(effect.category) ?? 0) + cents,
      );
    }
  }

  const lines: PlanLine[] = [];
  for (const category of categories) {
    const { key } = category;
    const line = rollup?.categories.get(key);
    const spentCents = line?.cents ?? 0;
    const upcomingCents = upcomingBy.get(key) ?? 0;
    const chosen = plannedFor(plans, key, month);
    const fixed = (line?.fixedCents ?? 0) + upcomingCents;
    const plannedCents = chosen ?? fixed;
    const from = rollovers.get(key);
    const carryCents = from ? carryFor(key, from, month, plans, rollups) : 0;
    if (
      plannedCents === 0 &&
      spentCents === 0 &&
      upcomingCents === 0 &&
      carryCents === 0
    ) {
      continue;
    }
    lines.push({
      key,
      group: category.group,
      plannedCents,
      explicit: chosen !== null,
      spentCents,
      upcomingCents,
      carryCents,
      availableCents: plannedCents + carryCents - spentCents - upcomingCents,
      rollover: from !== undefined,
      // L'épargne n'a pas de rythme à surveiller
      variable: fixed === 0 && key !== "savings",
    });
  }

  const plannedCents = lines.reduce((sum, line) => sum + line.plannedCents, 0);
  const expectedIncomeCents = (rollup?.incomeCents ?? 0) + upcomingIncome;
  const savings = lines.find((line) => line.key === "savings");
  const debtPlanned =
    lines.find((line) => line.key === "debt")?.plannedCents ?? 0;
  const minimumsReserveCents = Math.max(0, minimumsCents - debtPlanned);
  return {
    groups: BUDGET_GROUPS.map((group) => {
      const inGroup = lines.filter((line) => line.group === group);
      return {
        group,
        lines: inGroup,
        plannedCents: inGroup.reduce((sum, line) => sum + line.plannedCents, 0),
        usedCents: inGroup.reduce(
          (sum, line) => sum + line.spentCents + line.upcomingCents,
          0,
        ),
      };
    }).filter((entry) => entry.lines.length > 0),
    plannedCents,
    expectedIncomeCents,
    toAssignCents: expectedIncomeCents - plannedCents - minimumsReserveCents,
    minimumsReserveCents,
    reserveCents: savings
      ? Math.max(
          0,
          savings.plannedCents - savings.spentCents - savings.upcomingCents,
        )
      : 0,
  };
}

/** La part du mois déjà écoulée, de 0 à 1 (aujourd'hui compris). */
export function monthElapsed(month: string, today: string) {
  const { start, end } = periodOf("month", month);
  if (today < start) return 0;
  if (today > end) return 1;
  return (daysBetween(start, today) + 1) / (daysBetween(start, end) + 1);
}

export type LineStatus = "unplanned" | "over" | "fast" | "reached" | "ok";

/**
 * L'état d'une catégorie : sans montant prévu, dépassée, ou qui va plus vite que
 * le mois (10 points de marge : dépenser par à-coups n'est pas un problème).
 * L'épargne, elle, ne dépasse jamais : elle atteint ce qui était prévu.
 */
export function lineStatus(line: PlanLine, elapsed: number): LineStatus {
  const budget = line.plannedCents + line.carryCents;
  const used = line.spentCents + line.upcomingCents;
  if (line.key === "savings") {
    return budget > 0 && used >= budget ? "reached" : "ok";
  }
  if (budget <= 0) return used > 0 ? "unplanned" : "ok";
  if (line.availableCents < 0) return "over";
  if (line.variable && used / budget > elapsed + 0.1) return "fast";
  return "ok";
}

const roundDown5 = (cents: number) => Math.floor(cents / 500) * 500;

/**
 * Une première répartition, façon 50/30/20 : 50 % pour les essentiels, 30 % pour
 * les envies et 20 % pour l'épargne, d'où on retire les paiements fixes de chaque
 * groupe. Si les fixes prennent trop de place, tout rétrécit pour rester dans les
 * revenus. Un point de départ : la personne change ce qu'elle veut.
 */
export function suggestPlan(
  incomeCents: number,
  fixed: readonly { group: BudgetGroup; cents: number }[],
): { category: string; cents: number }[] {
  const fixedOf = (group: BudgetGroup) =>
    fixed
      .filter((entry) => entry.group === group)
      .reduce((sum, entry) => sum + entry.cents, 0);
  const left =
    incomeCents - fixedOf("needs") - fixedOf("wants") - fixedOf("savings");
  if (left <= 0) return [];
  const needs = Math.max(0, incomeCents * 0.5 - fixedOf("needs"));
  const wants = Math.max(0, incomeCents * 0.3 - fixedOf("wants"));
  const savings = Math.max(0, incomeCents * 0.2 - fixedOf("savings"));
  const total = needs + wants + savings;
  const scale = total > left ? left / total : 1;
  return [
    { category: "groceries", cents: roundDown5(needs * scale * 0.6) },
    { category: "transport", cents: roundDown5(needs * scale * 0.4) },
    { category: "restaurants", cents: roundDown5(wants * scale * 0.4) },
    { category: "leisure", cents: roundDown5(wants * scale * 0.3) },
    { category: "shopping", cents: roundDown5(wants * scale * 0.3) },
    { category: "savings", cents: roundDown5(savings * scale) },
  ].filter((entry) => entry.cents > 0);
}

/**
 * Les dépenses annuelles qu'on n'a pas encore préparées : les mettre de côté un
 * peu chaque mois évite la grosse surprise (les vraies dépenses, chez YNAB).
 */
export function annualToPrepare(
  rules: readonly BudgetRecurringRow[],
  plans: readonly PlanRow[],
  month: string,
): { rule: BudgetRecurringRow; monthlyCents: number }[] {
  return rules
    .filter(
      (rule) =>
        rule.kind === "expense" &&
        rule.frequency === "yearly" &&
        rule.category !== null &&
        (rule.endsOn === null || rule.endsOn >= month) &&
        plannedFor(plans, rule.category, month) === null,
    )
    .map((rule) => ({ rule, monthlyCents: monthlyEquivalent(rule) }));
}
