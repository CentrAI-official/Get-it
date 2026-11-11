import "server-only";
import {
  balanceOf,
  isDebtType,
  type AccountDelta,
  type AccountType,
  type BudgetAccountRow,
} from "@/features/budget/accounts";
import {
  categoryList,
  isBuiltInCategory,
  type CategoryInfo,
} from "@/features/budget/categories";
import {
  checkWindowStart,
  fixedPayments,
  outstandingIn,
  paysToConfirm,
  settledKeys,
  type FixedLog,
  type FixedPayment,
} from "@/features/budget/checklist";
import { repaidShare } from "@/features/budget/debts";
import { goalProgress } from "@/features/budget/goals";
import {
  annualToPrepare,
  buildMonthPlan,
  monthElapsed,
  rollupMonths,
  suggestPlan,
  type MonthlyRow,
  type MonthPlan,
  type PlanRow,
} from "@/features/budget/plan";
import {
  currencyOf,
  MAX_ENTRIES_PER_DAY,
  MAX_RECURRING,
  monthStart,
  periodOf,
  summarizeBudget,
  type AccountTypes,
  type BudgetEntryRow,
  type BudgetError,
  type BudgetFrequency,
  type BudgetKind,
  type BudgetRecurringRow,
  type BudgetSummary,
  type BudgetView,
  type EntryInput,
  type EntryKind,
  type RecurringInput,
  type UpcomingItem,
} from "@/features/budget/rules";
import { addDays, fromDbDate, toCalendarDay, toDbDate } from "@/lib/dates";
import { db } from "@/server/db";

// Financier › Budget. Données privées (Loi 25) : chaque fonction reçoit
// l'userId de la session et filtre dessus ; rien n'est montré aux autres
// membres ni envoyé à Get iT AI. Effacé avec le compte (onDelete: Cascade).

export const recurringSelect = {
  id: true,
  kind: true,
  label: true,
  category: true,
  amountCents: true,
  frequency: true,
  startsOn: true,
  endsOn: true,
  accountId: true,
  toAccountId: true,
  postedThrough: true,
  createdAt: true,
} as const;

export const entrySelect = {
  id: true,
  kind: true,
  category: true,
  amountCents: true,
  note: true,
  occurredOn: true,
  accountId: true,
  toAccountId: true,
  recurringId: true,
  goalId: true,
} as const;

const accountSelect = {
  id: true,
  name: true,
  type: true,
  openingCents: true,
  openedOn: true,
  rateBp: true,
  minimumCents: true,
  paymentDay: true,
} as const;

// Les colonnes texte sont bornées par les contraintes de la migration
export function toRecurring({
  createdAt,
  ...row
}: {
  id: string;
  kind: string;
  label: string;
  category: string | null;
  amountCents: number;
  frequency: string;
  startsOn: Date;
  endsOn: Date | null;
  accountId: string | null;
  toAccountId: string | null;
  postedThrough: Date | null;
  createdAt: Date;
}): BudgetRecurringRow {
  return {
    ...row,
    kind: row.kind as BudgetKind,
    frequency: row.frequency as BudgetFrequency,
    startsOn: fromDbDate(row.startsOn),
    endsOn: row.endsOn ? fromDbDate(row.endsOn) : null,
    postedThrough: row.postedThrough ? fromDbDate(row.postedThrough) : null,
    createdOn: createdAt.toISOString().slice(0, 10),
  };
}

export function toEntry(row: {
  id: string;
  kind: string;
  category: string | null;
  amountCents: number;
  note: string | null;
  occurredOn: Date;
  accountId: string | null;
  toAccountId: string | null;
  recurringId: string | null;
  goalId: string | null;
}): BudgetEntryRow {
  return {
    ...row,
    kind: row.kind as EntryKind,
    occurredOn: fromDbDate(row.occurredOn),
  };
}

function toAccount(row: {
  id: string;
  name: string;
  type: string;
  openingCents: number;
  openedOn: Date;
  rateBp: number | null;
  minimumCents: number | null;
  paymentDay: number | null;
}): BudgetAccountRow {
  return {
    ...row,
    type: row.type as AccountType,
    openedOn: fromDbDate(row.openedOn),
  };
}

/**
 * Les paiements fixes réglés depuis `from` (jusqu'à `to`) : ceux qui sont payés
 * (leur transaction, retrouvée par sa date prévue) et ceux qui n'ont pas eu lieu.
 */
export async function loadFixedLog(
  userId: string,
  from: string,
  to?: string,
): Promise<FixedLog> {
  const range = { gte: toDbDate(from), ...(to ? { lte: toDbDate(to) } : {}) };
  const [paid, skipped] = await Promise.all([
    db.budgetEntry.findMany({
      where: { userId, recurringId: { not: null }, recurringOn: range },
      select: { recurringId: true, recurringOn: true, amountCents: true },
    }),
    db.budgetSkip.findMany({
      where: { userId, occurredOn: range },
      select: { recurringId: true, occurredOn: true },
    }),
  ]);
  return {
    paid: paid.flatMap((row) =>
      row.recurringId && row.recurringOn
        ? [
            {
              recurringId: row.recurringId,
              day: fromDbDate(row.recurringOn),
              amountCents: row.amountCents,
            },
          ]
        : [],
    ),
    skipped: skipped.map((row) => ({
      recurringId: row.recurringId,
      day: fromDbDate(row.occurredOn),
    })),
  };
}

/** Ce qu'il faut à toutes les pages du budget. */
export type BudgetBase = {
  currency: "CAD" | "USD";
  today: string;
  categories: CategoryInfo[];
  accounts: BudgetAccountRow[];
  goals: { id: string; name: string; kind: string | null }[];
  rules: BudgetRecurringRow[];
  types: AccountTypes;
  /** Les paiements fixes réglés depuis `logFrom` (payés ou « pas ce mois-ci »). */
  log: FixedLog;
  logFrom: string;
  /** Leurs clés : ce qui n'y est pas reste à régler. */
  settled: ReadonlySet<string>;
};

/**
 * La base de chaque page. Plus rien ne s'inscrit tout seul (décision du
 * fondateur, 2026-11-10) : les paiements fixes se cochent, les paies se confirment.
 */
export async function getBudgetBase(userId: string): Promise<BudgetBase> {
  // Le 1er du mois d'avant, quel que soit le fuseau (la veille en UTC suffit)
  const logFrom = checkWindowStart(
    addDays(new Date().toISOString().slice(0, 10), -1),
  );
  const [profile, customRows, accountRows, goalRows, ruleRows, log] =
    await Promise.all([
      db.profile.findUnique({
        where: { id: userId },
        select: { country: true, settings: { select: { timeZone: true } } },
      }),
      db.budgetCategorySetting.findMany({
        where: { userId, name: { not: null } },
        orderBy: { createdAt: "asc" },
        select: { key: true, name: true, group: true, icon: true },
      }),
      db.budgetAccount.findMany({
        where: { userId, archivedAt: null },
        orderBy: { createdAt: "asc" },
        select: accountSelect,
      }),
      db.budgetGoal.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, kind: true },
      }),
      db.budgetRecurring.findMany({
        where: { userId },
        orderBy: [{ kind: "desc" }, { amountCents: "desc" }],
        take: MAX_RECURRING,
        select: recurringSelect,
      }),
      loadFixedLog(userId, logFrom),
    ]);
  const today = toCalendarDay(
    new Date(),
    profile?.settings?.timeZone ?? "America/Toronto",
  );
  const accounts = accountRows.map(toAccount);
  return {
    currency: currencyOf(profile?.country ?? null),
    today,
    categories: categoryList(customRows),
    accounts,
    goals: goalRows,
    rules: ruleRows.map(toRecurring),
    types: new Map(accounts.map((account) => [account.id, account.type])),
    log,
    logFrom,
    settled: settledKeys(log),
  };
}

/** Ce qui a bougé dans chaque compte, mois par mois, depuis son ouverture. */
export async function loadDeltas(userId: string): Promise<AccountDelta[]> {
  return db.$queryRaw<AccountDelta[]>`
    SELECT a.id::text AS "accountId",
           to_char(e.occurred_on, 'YYYY-MM') AS month,
           SUM(CASE
             WHEN e.to_account_id = a.id THEN e.amount_cents
             WHEN e.kind IN ('income', 'refund', 'adjustment') THEN e.amount_cents
             ELSE -e.amount_cents
           END)::float8 AS cents
    FROM budget_accounts a
    JOIN budget_entries e
      ON (e.account_id = a.id OR e.to_account_id = a.id)
     AND e.occurred_on >= a.opened_on
    WHERE a.user_id = ${userId}::uuid
      AND e.user_id = ${userId}::uuid
    GROUP BY 1, 2`;
}

/** Les paiements minimums des dettes qui ont encore un solde. */
export function debtMinimums(
  accounts: readonly BudgetAccountRow[],
  deltas: readonly AccountDelta[],
) {
  return accounts
    .filter(
      (account) =>
        isDebtType(account.type) &&
        (account.minimumCents ?? 0) > 0 &&
        balanceOf(account, deltas) < 0,
    )
    .reduce((sum, account) => sum + (account.minimumCents ?? 0), 0);
}

/** Les transactions additionnées par mois, entre deux jours. */
export async function monthlyRows(
  userId: string,
  from: string,
  to: string,
): Promise<MonthlyRow[]> {
  return db.$queryRaw<MonthlyRow[]>`
    SELECT to_char(occurred_on, 'YYYY-MM') AS month,
           kind,
           category,
           account_id::text AS "accountId",
           to_account_id::text AS "toAccountId",
           recurring_id IS NOT NULL AS fixed,
           SUM(amount_cents)::float8 AS cents
    FROM budget_entries
    WHERE user_id = ${userId}::uuid
      AND occurred_on >= ${toDbDate(from)}::date
      AND occurred_on <= ${toDbDate(to)}::date
    GROUP BY 1, 2, 3, 4, 5, 6`;
}

export async function loadPlans(userId: string): Promise<PlanRow[]> {
  const rows = await db.budgetPlan.findMany({
    where: { userId },
    select: { category: true, month: true, amountCents: true },
  });
  return rows.map((row) => ({ ...row, month: fromDbDate(row.month) }));
}

async function loadRollovers(userId: string) {
  const rows = await db.budgetCategorySetting.findMany({
    where: { userId, rolloverFrom: { not: null } },
    select: { key: true, rolloverFrom: true },
  });
  return new Map(
    rows.flatMap((row) =>
      row.rolloverFrom
        ? [[row.key, fromDbDate(row.rolloverFrom)] as const]
        : [],
    ),
  );
}

/** Les objectifs et ce que leurs transactions y ont mis de côté. */
export async function loadGoalRows(userId: string) {
  const [goals, totals] = await Promise.all([
    db.budgetGoal.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        targetCents: true,
        targetOn: true,
        startingCents: true,
        kind: true,
      },
    }),
    db.budgetEntry.groupBy({
      by: ["goalId"],
      where: { userId, goalId: { not: null } },
      _sum: { amountCents: true },
    }),
  ]);
  const added = new Map(
    totals.map((row) => [row.goalId, row._sum.amountCents ?? 0]),
  );
  return goals.map((goal) => ({
    ...goal,
    targetOn: goal.targetOn ? fromDbDate(goal.targetOn) : null,
    addedCents: added.get(goal.id) ?? 0,
  }));
}

export type BudgetPage = BudgetBase & {
  view: BudgetView;
  /** Premier et dernier jour de la période affichée. */
  start: string;
  end: string;
  summary: BudgetSummary;
  /** Le plan du mois (vue Mois seulement). */
  plan: MonthPlan | null;
  /** La part du mois écoulée, de 0 à 1. */
  elapsed: number;
  /** Les transactions de la période, les plus récentes d'abord. */
  entries: BudgetEntryRow[];
  /** Les dépenses et virements fixes du mois, à cocher (vue Mois seulement). */
  fixed: FixedPayment[];
  /** Ceux du mois d'avant pas encore cochés (mois en cours seulement). */
  leftover: FixedPayment[];
  /** Les paies arrivées qui attendent d'être confirmées. */
  pays: UpcomingItem[];
  /** « Dettes et épargne » : où en est chaque dette et chaque objectif. */
  progress: { debts: DebtBar[]; goals: GoalBar[] };
  /** Une première répartition, tant que rien n'a été choisi pour ce mois. */
  suggestion: { category: string; cents: number }[];
  /** Les dépenses annuelles pas encore préparées. */
  annual: { rule: BudgetRecurringRow; monthlyCents: number }[];
  /** Ce que demandent les objectifs d'épargne datés, par mois. */
  goalsMonthlyCents: number;
  /** Rien n'a encore été entré (premier passage). */
  empty: boolean;
};

/** Une dette, pour sa barre : ce qui reste et la part remboursée depuis son ajout. */
export type DebtBar = {
  id: string;
  name: string;
  owedCents: number;
  /** De 0 à 1 ; null si elle ne devait rien au départ. */
  share: number | null;
  minimumCents: number | null;
  paymentDay: number | null;
};

/** Un objectif d'épargne, pour sa barre. */
export type GoalBar = {
  id: string;
  name: string;
  savedCents: number;
  targetCents: number;
  percent: number;
  emergency: boolean;
};

/** Les barres « Dettes et épargne » : les dettes qui restent (ou finies), puis les objectifs. */
function progressBars(
  accounts: readonly BudgetAccountRow[],
  deltas: readonly AccountDelta[],
  goals: Awaited<ReturnType<typeof loadGoalRows>>,
  today: string,
): { debts: DebtBar[]; goals: GoalBar[] } {
  const debts: DebtBar[] = [];
  for (const account of accounts) {
    if (!isDebtType(account.type)) continue;
    const owedCents = Math.max(0, -balanceOf(account, deltas));
    const share = repaidShare(-account.openingCents, owedCents);
    // Une dette à 0 $ depuis le début n'a rien à montrer ; une dette finie, oui
    if (owedCents === 0 && share === null) continue;
    debts.push({
      id: account.id,
      name: account.name,
      owedCents,
      share,
      minimumCents: account.minimumCents,
      paymentDay: account.paymentDay,
    });
  }
  return {
    debts: debts.sort((a, b) => b.owedCents - a.owedCents),
    goals: goals
      .map((goal) => {
        const progress = goalProgress(goal, today);
        return {
          id: goal.id,
          name: goal.name,
          savedCents: progress.savedCents,
          targetCents: goal.targetCents,
          percent: progress.percent,
          emergency: goal.kind === "emergency",
        };
      })
      // Le fonds d'urgence d'abord
      .sort((a, b) => Number(b.emergency) - Number(a.emergency)),
  };
}

/** Le budget d'une période (jour, semaine ou mois) qui contient `day`. */
export async function getBudget(
  userId: string,
  input: { view: BudgetView; day: string | null },
): Promise<BudgetPage> {
  const base = await getBudgetBase(userId);
  const { today, types, rules, categories, settled } = base;
  const { start, end } = periodOf(input.view, input.day ?? today);
  const month = monthStart(start);
  const outflows = rules.filter((rule) => rule.kind !== "income");

  // Les soldes des dettes : pour leurs minimums et leurs barres
  const hasDebt = base.accounts.some((account) => isDebtType(account.type));
  const [entryRows, anyEntry, plans, rollovers, goalRows, deltas, oldLog] =
    await Promise.all([
      db.budgetEntry.findMany({
        where: {
          userId,
          occurredOn: { gte: toDbDate(start), lte: toDbDate(end) },
        },
        orderBy: [{ occurredOn: "desc" }, { createdAt: "desc" }],
        select: entrySelect,
      }),
      db.budgetEntry.findFirst({ where: { userId }, select: { id: true } }),
      loadPlans(userId),
      loadRollovers(userId),
      loadGoalRows(userId),
      hasDebt ? loadDeltas(userId) : Promise.resolve([]),
      // Un mois plus ancien : ses paiements réglés ne sont pas dans la base
      input.view === "month" && start < base.logFrom
        ? loadFixedLog(userId, start, end)
        : Promise.resolve(null),
    ]);

  // Le plan du mois, avec le report depuis le mois le plus ancien qui en a un
  const monthEnd = periodOf("month", month).end;
  const earliest = [...rollovers.values()].reduce(
    (first, from) => (from < first ? from : first),
    month,
  );
  const monthPlan = buildMonthPlan({
    month,
    categories,
    plans,
    rollups: rollupMonths(await monthlyRows(userId, earliest, monthEnd), types),
    upcoming: outstandingIn(rules, settled, month, monthEnd, today),
    rollovers,
    types,
    minimumsCents: debtMinimums(base.accounts, deltas),
  });
  const current = today >= start && today <= end;

  return {
    ...base,
    view: input.view,
    start,
    end,
    summary: summarizeBudget({
      entries: entryRows.map(toEntry),
      upcoming: outstandingIn(rules, settled, start, end, today),
      types,
      start,
      end,
      today,
      // L'épargne prévue n'est pas à dépenser : pour le mois en cours seulement
      reserveCents:
        input.view === "month" && end >= today ? monthPlan.reserveCents : 0,
    }),
    plan: input.view === "month" ? monthPlan : null,
    elapsed: monthElapsed(month, today),
    entries: entryRows.map(toEntry),
    fixed:
      input.view === "month"
        ? fixedPayments(outflows, oldLog ?? base.log, start, end, today)
        : [],
    leftover:
      input.view === "month" && current
        ? fixedPayments(
            outflows,
            base.log,
            checkWindowStart(today),
            addDays(start, -1),
            today,
          ).filter((item) => item.state === "due")
        : [],
    pays: paysToConfirm(rules, settled, today),
    progress: progressBars(base.accounts, deltas, goalRows, today),
    suggestion: monthPlan.groups.some((group) =>
      group.lines.some((line) => line.explicit),
    )
      ? []
      : suggestPlan(monthPlan.expectedIncomeCents, [
          ...monthPlan.groups.map((group) => ({
            group: group.group,
            cents: group.plannedCents,
          })),
          // Les minimums des dettes font partie des 20 % d'épargne et de dettes
          { group: "savings", cents: monthPlan.minimumsReserveCents },
        ]),
    annual: annualToPrepare(rules, plans, month),
    goalsMonthlyCents: goalRows.reduce(
      (sum, goal) => sum + (goalProgress(goal, today).monthlyCents ?? 0),
      0,
    ),
    empty: rules.length === 0 && anyEntry === null && plans.length === 0,
  };
}

type Result = { ok: true } | { ok: false; error: BudgetError };
type EntryResult = { ok: true; id: string } | { ok: false; error: BudgetError };

/**
 * Ce qui vient du navigateur appartient bien à la personne : ses comptes, son
 * objectif et sa catégorie personnelle.
 */
async function ownsReferences(
  userId: string,
  refs: {
    accountId?: string | null;
    toAccountId?: string | null;
    goalId?: string | null;
    category?: string | null;
  },
) {
  const accountIds = [refs.accountId, refs.toAccountId].filter(
    (id): id is string => Boolean(id),
  );
  const [accounts, goal, category] = await Promise.all([
    accountIds.length > 0
      ? db.budgetAccount.count({
          where: { userId, id: { in: accountIds } },
        })
      : 0,
    refs.goalId
      ? db.budgetGoal.count({ where: { userId, id: refs.goalId } })
      : 1,
    refs.category && !isBuiltInCategory(refs.category)
      ? db.budgetCategorySetting.count({
          where: { userId, key: refs.category, name: { not: null } },
        })
      : 1,
  ]);
  return accounts === new Set(accountIds).size && goal === 1 && category === 1;
}

/** Seulement les colonnes de la transaction. */
const entryData = (input: EntryInput) => ({
  kind: input.kind,
  category: input.category,
  amountCents: input.amountCents,
  note: input.note,
  occurredOn: toDbDate(input.occurredOn),
  accountId: input.accountId,
  toAccountId: input.toAccountId,
  goalId: input.goalId,
});

const recurringData = (input: RecurringInput) => ({
  kind: input.kind,
  label: input.label,
  category: input.category,
  amountCents: input.amountCents,
  frequency: input.frequency,
  startsOn: toDbDate(input.startsOn),
  endsOn: input.endsOn ? toDbDate(input.endsOn) : null,
  accountId: input.accountId,
  toAccountId: input.toAccountId,
});

/** Ajoute (`entryId` null) ou modifie une transaction. */
export async function saveEntry(
  userId: string,
  entryId: string | null,
  input: EntryInput,
): Promise<EntryResult> {
  if (!(await ownsReferences(userId, input))) {
    return { ok: false, error: "notFound" };
  }
  if (entryId) {
    const { count } = await db.budgetEntry.updateMany({
      // Une correction de solde ne se transforme pas : elle s'efface
      where: { id: entryId, userId, kind: { not: "adjustment" } },
      data: entryData(input),
    });
    return count > 0
      ? { ok: true, id: entryId }
      : { ok: false, error: "notFound" };
  }
  // Les paiements fixes et les lignes importées ne comptent pas dans cette limite
  const recent = await db.budgetEntry.count({
    where: {
      userId,
      recurringId: null,
      importKey: null,
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60_000) },
    },
  });
  if (recent >= MAX_ENTRIES_PER_DAY) return { ok: false, error: "entryLimit" };
  const { id } = await db.budgetEntry.create({
    data: { userId, ...entryData(input) },
    select: { id: true },
  });
  return { ok: true, id };
}

export async function deleteEntry(userId: string, entryId: string) {
  const { count } = await db.budgetEntry.deleteMany({
    where: { id: entryId, userId },
  });
  return count > 0;
}

/**
 * Ajoute (`recurringId` null) ou modifie un montant fixe. Le passé ne change pas :
 * seulement ce qui s'en vient. À l'ajout, `paidFirst` inscrit aussi son premier
 * paiement comme fait (« Répéter » d'une transaction qu'on vient d'entrer).
 */
export async function saveRecurring(
  userId: string,
  recurringId: string | null,
  input: RecurringInput,
  { paidFirst = false }: { paidFirst?: boolean } = {},
): Promise<Result> {
  if (!(await ownsReferences(userId, input))) {
    return { ok: false, error: "notFound" };
  }
  if (recurringId) {
    const posted = await db.budgetEntry.count({
      where: { userId, recurringId },
    });
    const { count } = await db.budgetRecurring.updateMany({
      where: { id: recurringId, userId },
      data: {
        ...recurringData(input),
        ...(posted === 0 ? { postedThrough: null } : {}),
      },
    });
    return count > 0 ? { ok: true } : { ok: false, error: "notFound" };
  }
  const count = await db.budgetRecurring.count({ where: { userId } });
  if (count >= MAX_RECURRING) return { ok: false, error: "recurringLimit" };
  await db.$transaction(async (tx) => {
    const rule = await tx.budgetRecurring.create({
      data: { userId, ...recurringData(input) },
      select: { id: true },
    });
    if (!paidFirst) return;
    await tx.budgetEntry.create({
      data: {
        userId,
        kind: input.kind,
        category: input.category,
        amountCents: input.amountCents,
        note: input.label,
        occurredOn: toDbDate(input.startsOn),
        accountId: input.accountId,
        toAccountId: input.toAccountId,
        recurringId: rule.id,
        recurringOn: toDbDate(input.startsOn),
      },
    });
  });
  return { ok: true };
}

/** Supprime un montant fixe ; ses paiements passés restent, sauf si on demande de les effacer. */
export async function deleteRecurring(
  userId: string,
  recurringId: string,
  withHistory = false,
) {
  return db.$transaction(async (tx) => {
    if (withHistory) {
      await tx.budgetEntry.deleteMany({ where: { userId, recurringId } });
    }
    const { count } = await tx.budgetRecurring.deleteMany({
      where: { id: recurringId, userId },
    });
    return count > 0;
  });
}

/** « Effacer mon budget » : tout ce qu'il contient. */
export async function eraseBudget(userId: string) {
  await db.$transaction([
    db.budgetEntry.deleteMany({ where: { userId } }),
    db.budgetSkip.deleteMany({ where: { userId } }),
    db.budgetRecurring.deleteMany({ where: { userId } }),
    db.budgetPlan.deleteMany({ where: { userId } }),
    db.budgetCategorySetting.deleteMany({ where: { userId } }),
    db.budgetGoal.deleteMany({ where: { userId } }),
    db.budgetAccount.deleteMany({ where: { userId } }),
  ]);
}
