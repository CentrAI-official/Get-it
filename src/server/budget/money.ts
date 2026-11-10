import "server-only";
import { balanceOf, isDebtType } from "@/features/budget/accounts";
import { groupOf } from "@/features/budget/categories";
import type { Debt } from "@/features/budget/debts";
import {
  cashEffect,
  cashFlowCheck,
  isSpendingType,
  moneyBasis,
  planMoney,
  safetyTargets,
  type CashEvent,
  type MoneyBasis,
  type MoneyPlan,
} from "@/features/budget/money-plan";
import { rollupMonths } from "@/features/budget/plan";
import { monthStart, occurrencesIn, upcomingIn } from "@/features/budget/rules";
import { addDays } from "@/lib/dates";
import { db } from "@/server/db";
import { loadDeltas } from "./accounts";
import { getBudget, monthlyRows, type BudgetPage } from "./service";

// Le plan d'argent de Financier › Budget : calculé par Get iT à chaque visite,
// à partir du budget de la personne (jamais envoyé à Get iT AI). La logique est
// dans src/features/budget/money-plan.ts.

/** Jours vérifiés pour s'assurer que l'argent est là à la date de chaque paiement. */
export const CASH_WINDOW_DAYS = 31;

export type MoneyView = {
  basis: MoneyBasis;
  /** Null quand il manque les revenus ou les dépenses, ou qu'il ne reste rien. */
  plan: MoneyPlan | null;
  missing: "income" | "spending" | null;
  cushionCents: number;
  fundCents: number;
  /** Déjà de côté pour les urgences : le fonds d'urgence, sinon les comptes d'épargne. */
  savedCents: number;
  emergencyGoalId: string | null;
  /** Les dettes du plan : avec un solde, un taux et un minimum. */
  debts: Debt[];
  /** Les dettes à compléter (sans taux ou sans minimum). */
  incomplete: { id: string; name: string }[];
  /** Null sans compte chèques ni comptant : le solde de départ est inconnu. */
  cash: ReturnType<typeof cashFlowCheck> | null;
};

const isCurrentMonth = (page: BudgetPage) =>
  page.view === "month" &&
  page.plan !== null &&
  page.start <= page.today &&
  page.end >= page.today;

/** Le plan d'argent, à partir du budget du mois en cours (relu s'il n'est pas fourni). */
export async function getMoneyView(
  userId: string,
  page?: BudgetPage,
): Promise<MoneyView> {
  const budget =
    page && isCurrentMonth(page)
      ? page
      : await getBudget(userId, { view: "month", day: null });
  const { today, types, rules, categories, accounts } = budget;
  const month = monthStart(today);
  const [deltas, rows, emergency] = await Promise.all([
    loadDeltas(userId),
    monthlyRows(userId, monthStart(month, -3), addDays(month, -1)),
    db.budgetGoal.findFirst({
      where: { userId, kind: "emergency" },
      select: { id: true, startingCents: true },
    }),
  ]);
  const added = emergency
    ? await db.budgetEntry.aggregate({
        where: { userId, goalId: emergency.id },
        _sum: { amountCents: true },
      })
    : null;

  // Les dettes, avec leur solde d'aujourd'hui
  const debts: Debt[] = [];
  const incomplete: { id: string; name: string }[] = [];
  const dues: { name: string; day: number; cents: number; id: string }[] = [];
  let minimumsCents = 0;
  for (const account of accounts) {
    if (!isDebtType(account.type)) continue;
    const balance = -balanceOf(account, deltas);
    if (balance <= 0) continue;
    const minimum = account.minimumCents ?? 0;
    minimumsCents += minimum;
    if (minimum > 0 && account.paymentDay !== null) {
      dues.push({
        id: account.id,
        name: account.name,
        day: account.paymentDay,
        cents: minimum,
      });
    }
    if (account.rateBp === null || minimum <= 0) {
      incomplete.push({ id: account.id, name: account.name });
      continue;
    }
    debts.push({
      id: account.id,
      name: account.name,
      balanceCents: balance,
      rateBp: account.rateBp,
      minimumCents: minimum,
    });
  }

  // Les mois d'avant : la moyenne des revenus et des dépenses de chaque groupe
  const past = [...rollupMonths(rows, types).values()];
  const count = Math.max(past.length, 1);
  let pastIncome = 0;
  let pastNeeds = 0;
  let pastWants = 0;
  for (const rollup of past) {
    pastIncome += rollup.incomeCents;
    for (const [key, line] of rollup.categories) {
      const group = groupOf(key, categories);
      if (group === "needs") pastNeeds += line.cents;
      else if (group === "wants") pastWants += line.cents;
    }
  }

  // Ce mois-ci : ce qui est prévu, ou ce qui est déjà sorti et à venir s'il y en a plus
  const plan = budget.plan;
  const plannedOf = (group: "needs" | "wants") =>
    (plan?.groups ?? [])
      .filter((entry) => entry.group === group)
      .flatMap((entry) => entry.lines)
      .reduce(
        (sum, line) =>
          sum +
          Math.max(line.plannedCents, line.spentCents + line.upcomingCents),
        0,
      );

  const basis = moneyBasis({
    expectedIncomeCents: plan?.expectedIncomeCents ?? 0,
    averageIncomeCents: pastIncome / count,
    plannedNeedsCents: plannedOf("needs"),
    plannedWantsCents: plannedOf("wants"),
    averageNeedsCents: pastNeeds / count,
    averageWantsCents: pastWants / count,
    minimumsCents,
  });
  const { cushionCents, fundCents } = safetyTargets(basis.essentialsCents);

  const savingsAccounts = accounts
    .filter((account) => account.type === "savings")
    .reduce((sum, account) => sum + balanceOf(account, deltas), 0);
  const savedCents = emergency
    ? emergency.startingCents + (added?._sum.amountCents ?? 0)
    : Math.max(0, savingsAccounts);

  const missing =
    basis.incomeCents <= 0
      ? "income"
      : basis.spendingCents <= 0 && minimumsCents <= 0
        ? "spending"
        : null;

  // L'argent est-il là à la date de chaque paiement?
  const spending = accounts.filter((account) => isSpendingType(account.type));
  let cash: MoneyView["cash"] = null;
  if (spending.length > 0) {
    const to = addDays(today, CASH_WINDOW_DAYS);
    const events: CashEvent[] = upcomingIn(rules, today, to, today)
      .map((item) => ({
        day: item.day,
        cents: cashEffect(item, types),
        label: item.label,
      }))
      .filter((event) => event.cents !== 0);
    // Un minimum sans paiement fixe inscrit compte quand même, à son jour
    for (const due of dues) {
      if (rules.some((rule) => rule.toAccountId === due.id)) continue;
      const days = occurrencesIn(
        {
          frequency: "monthly",
          startsOn: `2000-01-${String(due.day).padStart(2, "0")}`,
          endsOn: null,
        },
        addDays(today, 1),
        to,
      );
      for (const day of days) {
        events.push({ day, cents: -due.cents, label: due.name });
      }
    }
    cash = cashFlowCheck(
      spending.reduce((sum, account) => sum + balanceOf(account, deltas), 0),
      events,
    );
  }

  return {
    basis,
    plan:
      missing === null
        ? planMoney({
            surplusCents: basis.surplusCents,
            debts,
            savedCents,
            cushionCents,
            fundCents,
          })
        : null,
    missing,
    cushionCents,
    fundCents,
    savedCents,
    emergencyGoalId: emergency?.id ?? null,
    debts,
    incomplete,
    cash,
  };
}
