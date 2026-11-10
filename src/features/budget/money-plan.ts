import { addDays } from "@/lib/dates";
import { isDebtType, type AccountType } from "./accounts";
import type { Debt } from "./debts";
import { EMERGENCY_MONTHS } from "./goals";
import { occurrencesIn, type AccountTypes, type UpcomingItem } from "./rules";

// Le plan d'argent (décisions du fondateur, 2026-11-10). D'abord toutes les
// dépenses et tous les paiements minimums, à leur date : l'argent doit être là
// quand ils passent. Puis ce qui reste chaque mois va, dans l'ordre, à un coussin
// d'un mois de dépenses, aux dettes (le taux le plus élevé d'abord), au fonds
// d'urgence de 6 mois de dépenses, puis aux placements. Une dette finie donne son
// paiement à la suivante ; quand tout est payé, ce montant va à l'épargne : rien
// ne change dans le mois de la personne, mais son épargne grandit. Calculé par
// Get iT, jamais par l'IA (le budget n'est jamais envoyé à Get iT AI). Une
// estimation : les taux et les montants restent les mêmes. Fonctions pures.

/** Le coussin pour les imprévus, avant les dettes : un mois de dépenses. */
export const CUSHION_MONTHS = 1;

export const MONEY_STEPS = ["cushion", "debts", "fund", "invest"] as const;
export type MoneyStep = (typeof MONEY_STEPS)[number];

/** Après 50 ans, on arrête de compter. */
const MAX_MONTHS = 600;

/** Les cibles s'arrondissent à la centaine de dollars au-dessus. */
export const roundUp100 = (cents: number) =>
  Math.ceil(Math.max(0, cents) / 10_000) * 10_000;

export type MoneyBasis = {
  /** Les revenus d'un mois. */
  incomeCents: number;
  /** Les dépenses d'un mois (essentiels et envies), sans l'épargne ni les dettes. */
  spendingCents: number;
  /** Les paiements minimums des dettes. */
  minimumsCents: number;
  /** Ce qu'il faut pour vivre un mois : essentiels et minimums. */
  essentialsCents: number;
  /** Ce qui reste chaque mois, une fois tout payé (négatif : il manque de l'argent). */
  surplusCents: number;
};

/**
 * Le mois de base. Les revenus du mois (reçus et à venir), sinon la moyenne des
 * derniers mois. Pour les dépenses, le plus élevé du plan du mois et de la moyenne
 * des derniers mois, groupe par groupe : mieux vaut prévoir un peu trop.
 */
export function moneyBasis(input: {
  expectedIncomeCents: number;
  averageIncomeCents: number;
  plannedNeedsCents: number;
  plannedWantsCents: number;
  averageNeedsCents: number;
  averageWantsCents: number;
  minimumsCents: number;
}): MoneyBasis {
  const incomeCents =
    input.expectedIncomeCents > 0
      ? input.expectedIncomeCents
      : Math.max(0, input.averageIncomeCents);
  const needs = Math.max(input.plannedNeedsCents, input.averageNeedsCents, 0);
  const wants = Math.max(input.plannedWantsCents, input.averageWantsCents, 0);
  const spendingCents = Math.round(needs + wants);
  return {
    incomeCents: Math.round(incomeCents),
    spendingCents,
    minimumsCents: input.minimumsCents,
    essentialsCents: Math.round(needs) + input.minimumsCents,
    surplusCents: Math.round(incomeCents) - spendingCents - input.minimumsCents,
  };
}

/** Le coussin et le fonds d'urgence, à partir de ce qu'il faut pour vivre un mois. */
export function safetyTargets(essentialsCents: number) {
  return {
    cushionCents: roundUp100(essentialsCents * CUSHION_MONTHS),
    fundCents: roundUp100(essentialsCents * EMERGENCY_MONTHS),
  };
}

export type MoneyMoveLine = {
  step: MoneyStep;
  cents: number;
  /** La dette visée (étape des dettes). */
  debtId: string | null;
};

export type MoneyPlan = {
  /** L'étape où en est la personne aujourd'hui. */
  step: MoneyStep;
  /** Où va le surplus ce mois-ci, dans l'ordre. */
  thisMonth: MoneyMoveLine[];
  /**
   * Le mois où chaque étape est finie : 0 si elle l'est déjà, 1 pour ce mois-ci,
   * 2 pour le mois prochain ; null si elle ne finit pas (en 50 ans).
   */
  cushionMonth: number | null;
  debtsMonth: number | null;
  fundMonth: number | null;
  /** Le mois où l'argent commence à aller aux placements. */
  investMonth: number | null;
  /** Chaque dette, dans l'ordre où elle finit. */
  order: { id: string; month: number }[];
  interestCents: number;
  /** Ce qui ira chaque mois aux placements : le surplus et tous les minimums libérés. */
  investCents: number;
};

/** Avalanche : le taux le plus élevé d'abord, puis le plus petit solde. */
const byRate = (a: Debt, b: Debt) =>
  b.rateBp - a.rateBp || a.balanceCents - b.balanceCents;

/**
 * Mois par mois : les intérêts, les minimums, puis le surplus (avec les minimums
 * des dettes déjà finies) va au coussin, aux dettes, au fonds, aux placements.
 * Null quand il ne reste rien chaque mois : il faut d'abord réduire une dépense.
 */
export function planMoney({
  surplusCents,
  debts,
  savedCents,
  cushionCents,
  fundCents,
}: {
  surplusCents: number;
  debts: readonly Debt[];
  /** Déjà de côté pour les urgences. */
  savedCents: number;
  cushionCents: number;
  fundCents: number;
}): MoneyPlan | null {
  if (surplusCents <= 0) return null;
  const queue = debts
    .filter((debt) => debt.balanceCents > 0 && debt.minimumCents > 0)
    .sort(byRate);
  const balances = new Map(queue.map((debt) => [debt.id, debt.balanceCents]));
  const minimumsCents = queue.reduce((sum, debt) => sum + debt.minimumCents, 0);
  const active = () => queue.filter((debt) => (balances.get(debt.id) ?? 0) > 0);

  let saved = Math.max(0, savedCents);
  let cushionMonth: number | null = saved >= cushionCents ? 0 : null;
  let debtsMonth: number | null = queue.length === 0 ? 0 : null;
  let fundMonth: number | null = saved >= fundCents ? 0 : null;
  let investMonth: number | null = null;
  let interestCents = 0;
  const order: MoneyPlan["order"] = [];
  const thisMonth: MoneyMoveLine[] = [];

  const step: MoneyStep =
    cushionMonth === null
      ? "cushion"
      : queue.length > 0
        ? "debts"
        : fundMonth === null
          ? "fund"
          : "invest";

  for (let month = 1; month <= MAX_MONTHS && investMonth === null; month++) {
    const moves = new Map<string, MoneyMoveLine>();
    const move = (line: MoneyStep, cents: number, debtId: string | null) => {
      if (cents <= 0) return;
      const key = `${line}:${debtId ?? ""}`;
      const current = moves.get(key);
      if (current) current.cents += cents;
      else moves.set(key, { step: line, cents, debtId });
    };

    // Les intérêts du mois, puis les minimums
    for (const debt of active()) {
      const balance = balances.get(debt.id) ?? 0;
      const interest = Math.round((balance * debt.rateBp) / 10_000 / 12);
      interestCents += interest;
      balances.set(debt.id, balance + interest);
    }
    // Le surplus, plus ce que les minimums n'ont pas pris (dettes finies)
    let pool = surplusCents + minimumsCents;
    for (const debt of active()) {
      const balance = balances.get(debt.id) ?? 0;
      const paid = Math.min(debt.minimumCents, balance);
      balances.set(debt.id, balance - paid);
      pool -= paid;
    }

    // 1. Le coussin
    if (saved < cushionCents) {
      const cents = Math.min(pool, cushionCents - saved);
      saved += cents;
      pool -= cents;
      move("cushion", cents, null);
    }
    // 2. Les dettes, la plus chère d'abord
    for (const debt of active()) {
      if (pool <= 0) break;
      const balance = balances.get(debt.id) ?? 0;
      const cents = Math.min(pool, balance);
      balances.set(debt.id, balance - cents);
      pool -= cents;
      move("debts", cents, debt.id);
    }
    for (const debt of queue) {
      if (
        (balances.get(debt.id) ?? 0) <= 0 &&
        !order.some((entry) => entry.id === debt.id)
      ) {
        order.push({ id: debt.id, month });
      }
    }
    const debtsDone = active().length === 0;
    // 3. Le fonds d'urgence, une fois les dettes finies
    if (debtsDone && saved < fundCents) {
      const cents = Math.min(pool, fundCents - saved);
      saved += cents;
      pool -= cents;
      move("fund", cents, null);
    }
    // 4. Les placements
    if (debtsDone && saved >= fundCents && pool > 0) {
      move("invest", pool, null);
      investMonth = month;
    }

    if (cushionMonth === null && saved >= cushionCents) cushionMonth = month;
    if (debtsMonth === null && debtsDone) debtsMonth = month;
    if (fundMonth === null && debtsDone && saved >= fundCents) {
      fundMonth = month;
    }
    // Tout est fait sans rien de plus ce mois-ci : les placements commencent le suivant
    if (investMonth === null && fundMonth !== null && debtsDone) {
      investMonth = month + 1;
    }
    if (month === 1) thisMonth.push(...moves.values());
  }

  return {
    step,
    thisMonth,
    cushionMonth,
    debtsMonth,
    fundMonth,
    investMonth,
    order,
    interestCents,
    investCents: surplusCents + minimumsCents,
  };
}

/** Le prochain jour (aujourd'hui compris) qui tombe le `day` du mois ; un 31 tombe le 30 d'un mois court. */
export function nextDueDay(today: string, day: number) {
  return (
    occurrencesIn(
      {
        frequency: "monthly",
        startsOn: `2000-01-${String(day).padStart(2, "0")}`,
        endsOn: null,
      },
      today,
      addDays(today, 62),
      1,
    )[0] ?? today
  );
}

/** Le jour de départ d'un paiement mensuel : le premier qui tombe vraiment ce jour-là. */
export function monthlyStartFor(today: string, day: number) {
  for (let offset = 0; offset < 93; offset++) {
    const candidate = addDays(today, offset);
    if (Number(candidate.slice(8)) === day) return candidate;
  }
  return nextDueDay(today, day);
}

/** Les comptes d'où partent les paiements : chèques et comptant. */
export const isSpendingType = (type: AccountType | null | undefined) =>
  type === "chequing" || type === "cash";

export type CashEvent = {
  day: string;
  /** Signé : une entrée est positive. */
  cents: number;
  label: string;
};

/**
 * Ce que chaque paiement fixe fait aux comptes de tous les jours : une paie y
 * entre, une dépense en sort (sauf sur une carte de crédit : elle se paiera
 * plus tard), un virement en sort ou y revient.
 */
export function cashEffect(item: UpcomingItem, types: AccountTypes): number {
  const from = item.accountId ? types.get(item.accountId) : null;
  const to = item.toAccountId ? types.get(item.toAccountId) : null;
  switch (item.kind) {
    // Le compte d'une paie est celui où elle arrive
    case "income":
      return !from || isSpendingType(from) ? item.amountCents : 0;
    case "expense":
      return from && isDebtType(from) ? 0 : -item.amountCents;
    case "transfer": {
      const out = from === null || from === undefined || isSpendingType(from);
      const into = isSpendingType(to);
      if (out && !into) return -item.amountCents;
      if (!out && into) return item.amountCents;
      return 0;
    }
    // Un remboursement ou une correction n'est jamais un paiement fixe
    default:
      return 0;
  }
}

/**
 * Le solde des comptes de tous les jours, paiement après paiement : le premier
 * jour où il manquerait de l'argent, et le plus bas qu'il atteint. Le même jour,
 * les entrées passent avant les sorties.
 */
export function cashFlowCheck(
  startCents: number,
  events: readonly CashEvent[],
): {
  lowestCents: number;
  shortfall: { day: string; cents: number; label: string } | null;
} {
  const sorted = [...events].sort((a, b) =>
    a.day < b.day ? -1 : a.day > b.day ? 1 : b.cents - a.cents,
  );
  let balance = startCents;
  let lowestCents = startCents;
  let shortfall: { day: string; cents: number; label: string } | null = null;
  for (const event of sorted) {
    balance += event.cents;
    lowestCents = Math.min(lowestCents, balance);
    if (!shortfall && balance < 0) {
      shortfall = { day: event.day, cents: -balance, label: event.label };
    }
  }
  return { lowestCents, shortfall };
}
