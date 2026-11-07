import "server-only";
import {
  balanceOf,
  isDebtType,
  MAX_ACCOUNTS,
  netWorthOf,
  netWorthSeries,
  type AccountDelta,
  type AccountInput,
  type BudgetAccountRow,
} from "@/features/budget/accounts";
import type { Debt } from "@/features/budget/debts";
import { MAX_GOALS, type GoalInput } from "@/features/budget/goals";
import { monthsUntil } from "@/features/budget/reports";
import { BALANCE_MAX_CENTS, type BudgetError } from "@/features/budget/rules";
import { toDbDate } from "@/lib/dates";
import { db } from "@/server/db";
import { getBudgetBase, loadGoalRows } from "./service";

// Les comptes, la valeur nette, les objectifs d'épargne et les dettes. Chaque
// fonction reçoit l'userId de la session.

type Result = { ok: true } | { ok: false; error: BudgetError };

/** Ce qui a bougé dans chaque compte, mois par mois, depuis son ouverture. */
async function loadDeltas(userId: string): Promise<AccountDelta[]> {
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

export type AccountLine = BudgetAccountRow & { balanceCents: number };

export type AccountsPage = Awaited<ReturnType<typeof getBudgetBase>> & {
  lines: AccountLine[];
  assetsCents: number;
  debtsCents: number;
  netCents: number;
  /** La valeur nette à la fin de chaque mois, sur 12 mois. */
  series: { month: string; cents: number }[];
};

export async function getAccountsPage(userId: string): Promise<AccountsPage> {
  const base = await getBudgetBase(userId);
  const deltas = await loadDeltas(userId);
  const months = monthsUntil(base.today.slice(0, 7), 12);
  return {
    ...base,
    lines: base.accounts.map((account) => ({
      ...account,
      balanceCents: balanceOf(account, deltas),
    })),
    ...netWorthOf(base.accounts, deltas),
    series: netWorthSeries(base.accounts, deltas, months),
  };
}

const accountData = (input: AccountInput) => ({
  name: input.name,
  type: input.type,
  openingCents: input.openingCents,
  openedOn: toDbDate(input.openedOn),
  rateBp: input.rateBp,
  minimumCents: input.minimumCents,
});

/** Ajoute (`accountId` null) ou modifie un compte. */
export async function saveAccount(
  userId: string,
  accountId: string | null,
  input: AccountInput,
): Promise<Result> {
  if (accountId) {
    const { count } = await db.budgetAccount.updateMany({
      where: { id: accountId, userId },
      data: accountData(input),
    });
    return count > 0 ? { ok: true } : { ok: false, error: "notFound" };
  }
  const count = await db.budgetAccount.count({ where: { userId } });
  if (count >= MAX_ACCOUNTS) return { ok: false, error: "accountLimit" };
  await db.budgetAccount.create({ data: { userId, ...accountData(input) } });
  return { ok: true };
}

/**
 * « Mettre à jour le solde » : une correction de l'écart, sans effet sur le budget
 * (un placement qui monte, un compte qu'on n'a pas tout noté).
 */
export async function adjustBalance(
  userId: string,
  accountId: string,
  targetCents: number,
): Promise<Result> {
  const account = await db.budgetAccount.findFirst({
    where: { id: accountId, userId },
    select: {
      id: true,
      type: true,
      openingCents: true,
    },
  });
  if (!account) return { ok: false, error: "notFound" };
  const base = await getBudgetBase(userId);
  const deltas = await loadDeltas(userId);
  const target = isDebtType(account.type as AccountLine["type"])
    ? -Math.abs(targetCents)
    : targetCents;
  const gap = target - balanceOf(account, deltas);
  if (gap === 0) return { ok: true };
  if (Math.abs(gap) > BALANCE_MAX_CENTS) {
    return { ok: false, error: "amountInvalid" };
  }
  await db.budgetEntry.create({
    data: {
      userId,
      kind: "adjustment",
      category: null,
      amountCents: gap,
      occurredOn: toDbDate(base.today),
      accountId,
    },
  });
  return { ok: true };
}

/**
 * Supprime un compte. Ses dépenses et ses revenus restent dans le budget ; ce qui
 * n'a plus de sens sans lui disparaît (corrections de solde, virements sans compte).
 */
export async function deleteAccount(userId: string, accountId: string) {
  return db.$transaction(async (tx) => {
    const owned = await tx.budgetAccount.count({
      where: { id: accountId, userId },
    });
    if (owned === 0) return false;
    await tx.budgetEntry.deleteMany({
      where: {
        userId,
        OR: [
          { kind: "adjustment", accountId },
          { kind: "transfer", accountId, toAccountId: null },
          { kind: "transfer", toAccountId: accountId, accountId: null },
        ],
      },
    });
    await tx.budgetRecurring.deleteMany({
      where: {
        userId,
        kind: "transfer",
        OR: [{ accountId }, { toAccountId: accountId }],
      },
    });
    await tx.budgetAccount.deleteMany({ where: { id: accountId, userId } });
    return true;
  });
}

export type GoalsPage = Awaited<ReturnType<typeof getBudgetBase>> & {
  goalRows: Awaited<ReturnType<typeof loadGoalRows>>;
  /** Les dettes avec leur solde ; celles sans taux ou minimum sont à compléter. */
  debts: Debt[];
  incompleteDebts: { id: string; name: string }[];
  /** Les essentiels d'un mois, pour proposer un fonds d'urgence. */
  monthlyNeedsCents: number;
};

export async function getGoalsPage(userId: string): Promise<GoalsPage> {
  const base = await getBudgetBase(userId);
  const [goalRows, deltas, needs] = await Promise.all([
    loadGoalRows(userId),
    loadDeltas(userId),
    db.$queryRaw<{ cents: number }[]>`
      SELECT COALESCE(SUM(amount_cents), 0)::float8 / 3 AS cents
      FROM budget_entries
      WHERE user_id = ${userId}::uuid
        AND kind = 'expense'
        AND occurred_on >= ${toDbDate(base.today)}::date - 92
        AND category IN ('housing', 'utilities', 'phone', 'groceries', 'transport', 'insurance', 'health', 'children', 'fees', 'taxes')`,
  ]);
  const debts: Debt[] = [];
  const incompleteDebts: { id: string; name: string }[] = [];
  for (const account of base.accounts) {
    if (!isDebtType(account.type)) continue;
    const balance = -balanceOf(account, deltas);
    if (balance <= 0) continue;
    if (account.rateBp === null || !account.minimumCents) {
      incompleteDebts.push({ id: account.id, name: account.name });
    } else {
      debts.push({
        id: account.id,
        name: account.name,
        balanceCents: balance,
        rateBp: account.rateBp,
        minimumCents: account.minimumCents,
      });
    }
  }
  return {
    ...base,
    goalRows,
    debts,
    incompleteDebts,
    monthlyNeedsCents: Math.round(needs[0]?.cents ?? 0),
  };
}

const goalData = (input: GoalInput) => ({
  name: input.name,
  targetCents: input.targetCents,
  targetOn: input.targetOn ? toDbDate(input.targetOn) : null,
  startingCents: input.startingCents,
});

/** Ajoute (`goalId` null) ou modifie un objectif d'épargne. */
export async function saveGoal(
  userId: string,
  goalId: string | null,
  input: GoalInput,
): Promise<Result> {
  if (goalId) {
    const { count } = await db.budgetGoal.updateMany({
      where: { id: goalId, userId },
      data: goalData(input),
    });
    return count > 0 ? { ok: true } : { ok: false, error: "notFound" };
  }
  const count = await db.budgetGoal.count({ where: { userId } });
  if (count >= MAX_GOALS) return { ok: false, error: "goalLimit" };
  await db.budgetGoal.create({ data: { userId, ...goalData(input) } });
  return { ok: true };
}

/** Supprime un objectif : l'argent mis de côté reste dans les transactions. */
export async function deleteGoal(userId: string, goalId: string) {
  const { count } = await db.budgetGoal.deleteMany({
    where: { id: goalId, userId },
  });
  return count > 0;
}
