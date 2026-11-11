import { addDays } from "@/lib/dates";
import {
  monthStart,
  occurrencesIn,
  type BudgetRecurringRow,
  type UpcomingItem,
} from "./rules";

// Les paiements fixes (décision du fondateur, 2026-11-10) : plus rien ne s'inscrit
// tout seul. Une dépense ou un virement fixe se coche quand il est payé (rappel la
// veille à 9 h), une paie se confirme au montant reçu, « pour cette fois
// seulement ». Tant que ce n'est pas fait, ils comptent dans ce qui s'en vient.
// Fonctions pures.

/** Un oubli reste à cocher pendant le mois suivant, puis disparaît. */
export const CHECK_MONTHS_BACK = 1;
/** On coche d'avance un paiement de ce nombre de jours au plus. */
export const CHECK_DAYS_AHEAD = 62;
/** Le rappel part la veille à partir de cette heure (fuseau de la personne)… */
export const REMINDER_HOUR = 9;
/** … et plus après celle-ci : jamais la nuit. */
export const REMINDER_LAST_HOUR = 21;

/** Ce qu'on fait d'un paiement fixe : payé, « pas ce mois-ci », ou de nouveau à payer. */
export const FIXED_ACTIONS = ["paid", "skipped", "open"] as const;
export type FixedAction = (typeof FIXED_ACTIONS)[number];

/** La clé d'un paiement : le montant fixe et sa date prévue. */
export const occurrenceKey = (recurringId: string, day: string) =>
  `${recurringId}:${day}`;

/** Le premier jour d'où l'on garde les oublis (le 1er du mois d'avant). */
export const checkWindowStart = (today: string) =>
  monthStart(today, -CHECK_MONTHS_BACK);

const latest = (days: readonly string[]) =>
  days.reduce((last, day) => (day > last ? day : last));

/**
 * Le premier jour à régler d'un montant fixe : jamais avant le mois d'avant, ni
 * avant le mois où il a été ajouté (un loyer du 1er ajouté le 10 reste à cocher
 * pour ce 1er, mais pas pour les mois d'avant), ni avant ce que l'ancien système
 * a déjà inscrit tout seul.
 */
export function settleFrom(
  rule: Pick<BudgetRecurringRow, "startsOn" | "createdOn" | "postedThrough">,
  today: string,
): string {
  return latest([
    checkWindowStart(today),
    rule.startsOn,
    monthStart(rule.createdOn),
    ...(rule.postedThrough ? [addDays(rule.postedThrough, 1)] : []),
  ]);
}

/** Ce qui est réglé : les paiements faits (leur transaction) et ceux qui n'ont pas eu lieu. */
export type FixedLog = {
  paid: readonly { recurringId: string; day: string; amountCents: number }[];
  skipped: readonly { recurringId: string; day: string }[];
};

export function settledKeys(log: FixedLog): Set<string> {
  return new Set([
    ...log.paid.map((item) => occurrenceKey(item.recurringId, item.day)),
    ...log.skipped.map((item) => occurrenceKey(item.recurringId, item.day)),
  ]);
}

const byDay = (a: { day: string }, b: { day: string }) =>
  a.day < b.day ? -1 : a.day > b.day ? 1 : 0;

/**
 * Ce qui reste à régler entre `from` et `to` : les paiements à venir, et ceux
 * dont la date est passée sans être cochés (ou une paie pas encore confirmée).
 */
export function outstandingIn(
  rules: readonly BudgetRecurringRow[],
  settled: ReadonlySet<string>,
  from: string,
  to: string,
  today: string,
): UpcomingItem[] {
  return rules
    .flatMap((rule) => {
      const first = settleFrom(rule, today);
      return occurrencesIn(rule, from > first ? from : first, to)
        .filter((day) => !settled.has(occurrenceKey(rule.id, day)))
        .map((day) => ({
          kind: rule.kind,
          category: rule.category,
          amountCents: rule.amountCents,
          accountId: rule.accountId,
          toAccountId: rule.toAccountId,
          recurringId: rule.id,
          label: rule.label,
          day,
          frequency: rule.frequency,
        }));
    })
    .sort(byDay);
}

/** Les paies arrivées qui attendent d'être confirmées, la plus ancienne d'abord. */
export function paysToConfirm(
  rules: readonly BudgetRecurringRow[],
  settled: ReadonlySet<string>,
  today: string,
): UpcomingItem[] {
  return outstandingIn(
    rules.filter((rule) => rule.kind === "income"),
    settled,
    checkWindowStart(today),
    today,
    today,
  );
}

export type FixedState = "paid" | "skipped" | "due" | "upcoming";

export type FixedPayment = {
  recurringId: string;
  kind: BudgetRecurringRow["kind"];
  label: string;
  /** La date prévue. */
  day: string;
  plannedCents: number;
  /** Le montant de la transaction, une fois payé (il peut différer du prévu). */
  paidCents: number | null;
  /** `due` : la date est arrivée, pas encore coché. */
  state: FixedState;
};

/**
 * Les paiements fixes d'une période, réglés ou non, par date. Un paiement fait
 * reste visible même si la date du montant fixe a changé depuis.
 */
export function fixedPayments(
  rules: readonly BudgetRecurringRow[],
  log: FixedLog,
  from: string,
  to: string,
  today: string,
): FixedPayment[] {
  const paid = new Map(
    log.paid.map((item) => [
      occurrenceKey(item.recurringId, item.day),
      item.amountCents,
    ]),
  );
  const skipped = new Set(
    log.skipped.map((item) => occurrenceKey(item.recurringId, item.day)),
  );
  const items: FixedPayment[] = [];
  for (const rule of rules) {
    const first = settleFrom(rule, today);
    const days = new Set(occurrencesIn(rule, from, to));
    for (const item of log.paid) {
      if (item.recurringId === rule.id && item.day >= from && item.day <= to) {
        days.add(item.day);
      }
    }
    for (const day of days) {
      const key = occurrenceKey(rule.id, day);
      const paidCents = paid.get(key) ?? null;
      const state: FixedState | null =
        paidCents !== null
          ? "paid"
          : skipped.has(key)
            ? "skipped"
            : day < first
              ? null
              : day <= today
                ? "due"
                : "upcoming";
      if (state === null) continue;
      items.push({
        recurringId: rule.id,
        kind: rule.kind,
        label: rule.label,
        day,
        plannedCents: rule.amountCents,
        paidCents,
        state,
      });
    }
  }
  return items.sort(
    (a, b) => byDay(a, b) || a.label.localeCompare(b.label, "fr"),
  );
}

/**
 * Le paiement à rappeler la veille, à cette heure (fuseau de la personne) : une
 * dépense ou un virement fixe qui tombe demain et pas encore rappelé. Null sinon.
 * Qu'il soit déjà payé ou « pas ce mois-ci » se vérifie ensuite dans la base.
 */
export function reminderDay(
  rule: Pick<
    BudgetRecurringRow,
    "kind" | "frequency" | "startsOn" | "endsOn"
  > & { remindedOn: string | null },
  today: string,
  hour: number,
): string | null {
  if (rule.kind === "income") return null;
  if (hour < REMINDER_HOUR || hour > REMINDER_LAST_HOUR) return null;
  const tomorrow = addDays(today, 1);
  if (occurrencesIn(rule, tomorrow, tomorrow).length === 0) return null;
  if (rule.remindedOn !== null && rule.remindedOn >= tomorrow) return null;
  return tomorrow;
}

/**
 * Une date qu'on peut régler pour ce montant fixe : depuis le mois d'avant
 * jusqu'à deux mois d'avance ; une paie seulement une fois arrivée.
 */
export function canSettle(
  rule: Pick<BudgetRecurringRow, "kind">,
  day: string,
  today: string,
): boolean {
  if (day < checkWindowStart(today)) return false;
  if (rule.kind === "income") return day <= today;
  return day <= addDays(today, CHECK_DAYS_AHEAD);
}
