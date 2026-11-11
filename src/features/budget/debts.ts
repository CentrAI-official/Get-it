// Rembourser ses dettes : avalanche (le taux le plus élevé d'abord, moins
// d'intérêts) ou boule de neige (le plus petit solde d'abord, des victoires plus
// vite). Chaque mois, on paie tous les minimums et le surplus va à une seule
// dette ; une dette finie donne son paiement à la suivante. Une estimation : le
// taux reste le même et rien ne s'ajoute à la dette. Fonctions pures.

export const DEBT_STRATEGIES = ["avalanche", "snowball"] as const;
export type DebtStrategy = (typeof DEBT_STRATEGIES)[number];

export type Debt = {
  id: string;
  name: string;
  balanceCents: number;
  rateBp: number;
  minimumCents: number;
};

export type PayoffResult = {
  /** Mois avant d'avoir tout remboursé. */
  months: number;
  interestCents: number;
  /** Chaque dette, dans l'ordre où elle finit. */
  order: { id: string; month: number }[];
  /** Faux si les paiements ne suffisent pas à finir (ils couvrent à peine les intérêts). */
  finished: boolean;
};

/**
 * La part remboursée d'une dette depuis son ajout dans Get iT, de 0 à 1 (la barre
 * « Dettes et épargne ») ; null si elle ne devait rien au départ (une carte de
 * crédit ouverte à 0 $ : rien à quoi se comparer).
 */
export function repaidShare(
  openingOwedCents: number,
  owedCents: number,
): number | null {
  if (openingOwedCents <= 0) return null;
  return Math.min(
    1,
    Math.max(0, (openingOwedCents - owedCents) / openingOwedCents),
  );
}

/** Après 50 ans, on arrête de compter : les paiements ne suffisent pas. */
const MAX_MONTHS = 600;

const byStrategy = (strategy: DebtStrategy) => (a: Debt, b: Debt) =>
  strategy === "avalanche"
    ? b.rateBp - a.rateBp || a.balanceCents - b.balanceCents
    : a.balanceCents - b.balanceCents || b.rateBp - a.rateBp;

/**
 * Mois par mois : les intérêts, les minimums, puis le surplus. Sans `strategy`,
 * seulement les minimums, et une dette finie ne donne rien à la suivante.
 */
export function simulatePayoff(
  debts: readonly Debt[],
  extraCents: number,
  strategy: DebtStrategy | null,
): PayoffResult {
  const queue = strategy ? [...debts].sort(byStrategy(strategy)) : [...debts];
  const balances = new Map(queue.map((debt) => [debt.id, debt.balanceCents]));
  const budget = queue.reduce((sum, debt) => sum + debt.minimumCents, 0);
  const order: PayoffResult["order"] = [];
  let interestCents = 0;
  let month = 0;

  const active = () => queue.filter((debt) => (balances.get(debt.id) ?? 0) > 0);
  while (active().length > 0 && month < MAX_MONTHS) {
    month += 1;
    for (const debt of active()) {
      const balance = balances.get(debt.id) ?? 0;
      const interest = Math.round((balance * debt.rateBp) / 10_000 / 12);
      interestCents += interest;
      balances.set(debt.id, balance + interest);
    }
    let surplus = strategy ? budget + extraCents : 0;
    for (const debt of active()) {
      const balance = balances.get(debt.id) ?? 0;
      const paid = Math.min(debt.minimumCents, balance);
      balances.set(debt.id, balance - paid);
      surplus -= paid;
    }
    if (strategy) {
      for (const debt of active()) {
        if (surplus <= 0) break;
        const balance = balances.get(debt.id) ?? 0;
        const paid = Math.min(surplus, balance);
        balances.set(debt.id, balance - paid);
        surplus -= paid;
      }
    }
    for (const debt of queue) {
      if (
        (balances.get(debt.id) ?? 0) <= 0 &&
        !order.some((entry) => entry.id === debt.id)
      ) {
        order.push({ id: debt.id, month });
      }
    }
  }
  return {
    months: month,
    interestCents,
    order,
    finished: active().length === 0,
  };
}
