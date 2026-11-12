import { daysBetween } from "@/lib/dates";
import type { FixedPayment } from "./checklist";
import { isFixedOnly, lineStatus, type MonthPlan, type PlanLine } from "./plan";

// Les enveloppes (décision du fondateur, 2026-11-12 : la maquette 3 du budget) :
// chaque catégorie du plan est une enveloppe qui montre ce qui y reste ; les
// paiements fixes, les dettes et les objectifs ont chacun leur grande carte.
// Fonctions pures.

export type EnvelopeState =
  /** Rien n'est encore sorti ce mois-ci. */
  | "untouched"
  | "ok"
  /** Elle se vide plus vite que le mois. */
  | "fast"
  | "over"
  /** De l'argent est sorti, sans montant prévu. */
  | "unplanned";

export type Envelope = {
  key: string;
  /** Le montant prévu, avec le report. */
  budgetCents: number;
  /** Ce qui reste (négatif quand elle est dépassée). */
  leftCents: number;
  /** Déjà sorti. */
  spentCents: number;
  /** La part qui reste, de 0 à 1 : la barre. */
  share: number;
  state: EnvelopeState;
};

export type SavingsEnvelope = {
  budgetCents: number;
  /** Déjà mis de côté. */
  savedCents: number;
  /** Encore à mettre de côté. */
  leftCents: number;
  /** La part faite, de 0 à 1. */
  share: number;
  reached: boolean;
};

const clamp = (value: number) => Math.min(Math.max(value, 0), 1);

/** Une catégorie au jour le jour devient une enveloppe ; celles des paiements fixes, non. */
export function isEnvelope(line: PlanLine, elapsed: number) {
  if (line.key === "savings") return false;
  return !isFixedOnly(line) || lineStatus(line, elapsed) === "over";
}

function envelopeOf(line: PlanLine, elapsed: number): Envelope {
  const budgetCents = line.plannedCents + line.carryCents;
  const status = lineStatus(line, elapsed);
  const state: EnvelopeState =
    status === "unplanned" || status === "over" || status === "fast"
      ? status
      : line.spentCents === 0 && line.upcomingCents === 0
        ? "untouched"
        : "ok";
  return {
    key: line.key,
    budgetCents,
    leftCents: line.availableCents,
    spentCents: line.spentCents,
    share: budgetCents > 0 ? clamp(line.availableCents / budgetCents) : 0,
    state,
  };
}

/**
 * Les enveloppes du mois, dans l'ordre du plan (essentiels, puis envies), et
 * l'épargne à part : elle se remplit au lieu de se vider.
 */
export function envelopesOf(
  plan: MonthPlan,
  elapsed: number,
): { envelopes: Envelope[]; savings: SavingsEnvelope | null } {
  const lines = plan.groups.flatMap((group) => group.lines);
  const envelopes = lines
    .filter((line) => isEnvelope(line, elapsed))
    .map((line) => envelopeOf(line, elapsed));
  const line = lines.find((entry) => entry.key === "savings");
  if (!line) return { envelopes, savings: null };
  const budgetCents = line.plannedCents + line.carryCents;
  const savedCents = Math.max(line.spentCents, 0);
  return {
    envelopes,
    savings: {
      budgetCents,
      savedCents,
      leftCents: Math.max(budgetCents - savedCents, 0),
      share: budgetCents > 0 ? clamp(savedCents / budgetCents) : 0,
      reached: budgetCents > 0 && savedCents >= budgetCents,
    },
  };
}

export type DueWhen =
  | { kind: "late" }
  | { kind: "today" }
  | { kind: "tomorrow" }
  /** Cette semaine : le nom du jour. */
  | { kind: "weekday"; day: string }
  | { kind: "date"; day: string };

/** Quand tombe un paiement, pour la carte : en retard, aujourd'hui, demain, un jour de la semaine ou une date. */
export function dueWhen(day: string, today: string): DueWhen {
  const days = daysBetween(today, day);
  if (days < 0) return { kind: "late" };
  if (days === 0) return { kind: "today" };
  if (days === 1) return { kind: "tomorrow" };
  return days < 7 ? { kind: "weekday", day } : { kind: "date", day };
}

export type FixedSummary = {
  /** Ce qui reste à payer ce mois-ci. */
  leftCents: number;
  paid: number;
  /** Sans ceux de « Pas ce mois-ci ». */
  count: number;
  /** Encore à payer ce mois-ci. */
  open: number;
  /** Les deux prochains à payer, par date. */
  next: { label: string; day: string }[];
  /** Ceux du mois passé, pas encore cochés. */
  late: number;
};

/** La carte des paiements fixes : combien il reste, combien sont payés, et les prochains. */
export function fixedSummary(
  thisMonth: readonly FixedPayment[],
  lastMonth: readonly FixedPayment[],
): FixedSummary {
  const counted = thisMonth.filter((item) => item.state !== "skipped");
  const open = counted
    .filter((item) => item.state !== "paid")
    .sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
  return {
    leftCents: open.reduce((sum, item) => sum + item.plannedCents, 0),
    paid: counted.length - open.length,
    count: counted.length,
    open: open.length,
    next: open
      .slice(0, 2)
      .map((item) => ({ label: item.label, day: item.day })),
    late: lastMonth.filter((item) => item.state === "due").length,
  };
}

/** Une enveloppe de « Répartir » : son montant se change. */
export type AssignRow = { key: string; plannedCents: number };

/**
 * Ce que montre « Répartir » : les enveloppes à choisir (l'épargne comprise), et
 * le total des catégories faites seulement de paiements fixes, qui se règlent
 * dans Factures.
 */
export function assignRows(plan: MonthPlan, elapsed: number) {
  const lines = plan.groups.flatMap((group) => group.lines);
  const editable = lines.filter(
    (line) => line.key === "savings" || isEnvelope(line, elapsed),
  );
  const fixed = lines.filter((line) => !editable.includes(line));
  return {
    rows: editable.map((line): AssignRow => ({
      key: line.key,
      plannedCents: line.plannedCents,
    })),
    fixed: fixed.map((line) => ({ key: line.key, cents: line.plannedCents })),
  };
}

/**
 * Ce qui reste sans enveloppe pendant qu'on répartit : les revenus du mois,
 * moins les paiements fixes, moins chaque enveloppe, moins les minimums des
 * dettes que l'enveloppe Dettes ne prévoit pas encore (le même calcul que le
 * plan du mois).
 */
export function unassignedCents({
  incomeCents,
  minimumsCents,
  fixed,
  amounts,
}: {
  incomeCents: number;
  minimumsCents: number;
  fixed: readonly { key: string; cents: number }[];
  /** Enveloppe → montant choisi. */
  amounts: ReadonlyMap<string, number>;
}) {
  let planned = 0;
  for (const cents of amounts.values()) planned += cents;
  for (const line of fixed) planned += line.cents;
  const debt =
    amounts.get("debt") ??
    fixed.find((line) => line.key === "debt")?.cents ??
    0;
  return incomeCents - planned - Math.max(0, minimumsCents - debt);
}
