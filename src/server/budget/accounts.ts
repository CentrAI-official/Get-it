import "server-only";
import {
  balanceOf,
  isDebtType,
  MAX_ACCOUNTS,
  netWorthOf,
  netWorthSeries,
  type AccountInput,
  type BudgetAccountRow,
} from "@/features/budget/accounts";
import { MAX_GOALS, type GoalInput } from "@/features/budget/goals";
import { monthsUntil } from "@/features/budget/reports";
import { BALANCE_MAX_CENTS, type BudgetError } from "@/features/budget/rules";
import { toDbDate } from "@/lib/dates";
import { db } from "@/server/db";
import { getBudgetBase, loadDeltas, loadGoalRows } from "./service";

// Les comptes, la valeur nette, les objectifs d'épargne et les dettes. Chaque
// fonction reçoit l'userId de la session.

type Result = { ok: true } | { ok: false; error: BudgetError };

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
  paymentDay: input.paymentDay,
});

/** Ajoute (`accountId` null) ou modifie un compte. */
export async function saveAccount(
  userId: string,
  accountId: string | null,
  input: AccountInput,
): Promise<{ ok: true; id: string } | { ok: false; error: BudgetError }> {
  if (accountId) {
    const { count } = await db.budgetAccount.updateMany({
      where: { id: accountId, userId },
      data: accountData(input),
    });
    return count > 0
      ? { ok: true, id: accountId }
      : { ok: false, error: "notFound" };
  }
  const count = await db.budgetAccount.count({ where: { userId } });
  if (count >= MAX_ACCOUNTS) return { ok: false, error: "accountLimit" };
  const { id } = await db.budgetAccount.create({
    data: { userId, ...accountData(input) },
    select: { id: true },
  });
  return { ok: true, id };
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

/** Les objectifs d'épargne ; les dettes et le fonds d'urgence viennent du plan d'argent (`getMoneyView`). */
export async function loadGoals(userId: string) {
  return loadGoalRows(userId);
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
  const [count, emergency] = await Promise.all([
    db.budgetGoal.count({ where: { userId } }),
    input.kind
      ? db.budgetGoal.count({ where: { userId, kind: input.kind } })
      : 0,
  ]);
  if (count >= MAX_GOALS) return { ok: false, error: "goalLimit" };
  // Un seul fonds d'urgence : un deuxième reste un objectif comme les autres
  await db.budgetGoal.create({
    data: {
      userId,
      ...goalData(input),
      kind: emergency === 0 ? input.kind : null,
    },
  });
  return { ok: true };
}

/** Supprime un objectif : l'argent mis de côté reste dans les transactions. */
export async function deleteGoal(userId: string, goalId: string) {
  const { count } = await db.budgetGoal.deleteMany({
    where: { id: goalId, userId },
  });
  return count > 0;
}
