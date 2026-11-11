import { z } from "zod";
import { addDays, daysBetween, isoWeekday } from "@/lib/dates";
import { fieldErrorsFrom } from "@/lib/form-errors";
import { isSavingsType, type AccountType } from "./accounts";
import { isCategoryKey } from "./categories";

// Financier › Budget (décisions du fondateur, 2026-11-01 et 2026-11-04) : les
// transactions, les montants fixes qui en deviennent à leur date, et le suivi par
// jour, semaine ou mois. Listes et limites alignées sur les migrations
// 20261114120000_budget et 20261118120000_budget_complete (un test le vérifie).
// Fonctions pures.

/** Ce qu'enregistre une transaction : un remboursement réduit une dépense, une correction ajuste le solde d'un compte. */
export const ENTRY_KINDS = [
  "income",
  "expense",
  "refund",
  "transfer",
  "adjustment",
] as const;
export type EntryKind = (typeof ENTRY_KINDS)[number];

/** Ce que l'on choisit dans les formulaires. */
export const BUDGET_KINDS = ["expense", "income", "transfer"] as const;
export type BudgetKind = (typeof BUDGET_KINDS)[number];

export const BUDGET_FREQUENCIES = [
  "daily",
  "weekly",
  "biweekly",
  "monthly",
  "yearly",
] as const;
export type BudgetFrequency = (typeof BUDGET_FREQUENCIES)[number];

export const BUDGET_VIEWS = ["day", "week", "month"] as const;
export type BudgetView = (typeof BUDGET_VIEWS)[number];

export const BUDGET_LABEL_MAX = 60;
export const BUDGET_NOTE_MAX = 80;
/** 1 000 000 $ au plus par montant. */
export const BUDGET_AMOUNT_MAX_CENTS = 100_000_000;
/** Revenus et dépenses fixes gardés au plus par personne. */
export const MAX_RECURRING = 100;
/** Mouvements ajoutés au plus en 24 heures. */
export const MAX_ENTRIES_PER_DAY = 200;

/** Erreurs affichables (clés de `Budget.errors`). */
export const BUDGET_ERRORS = [
  "amountInvalid",
  "rateInvalid",
  "dayInvalid",
  "accountRequired",
  "sameAccount",
  "accountLimit",
  "goalLimit",
  "categoryLimit",
  "importLimit",
  "categoryRequired",
  "labelRequired",
  "labelTooLong",
  "noteTooLong",
  "dateInvalid",
  "endBeforeStart",
  "recurringLimit",
  "entryLimit",
  "notFound",
  "unexpected",
] as const;
export type BudgetError = (typeof BUDGET_ERRORS)[number];

export function isBudgetError(value: unknown): value is BudgetError {
  return BUDGET_ERRORS.includes(value as BudgetError);
}

/** Une transaction, telle que l'affiche la page. */
export type BudgetEntryRow = {
  id: string;
  kind: EntryKind;
  category: string | null;
  amountCents: number;
  note: string | null;
  /** « AAAA-MM-JJ ». */
  occurredOn: string;
  accountId: string | null;
  toAccountId: string | null;
  /** Vient d'un montant fixe. */
  recurringId: string | null;
  goalId: string | null;
};

/** Un revenu, une dépense ou un virement fixe. */
export type BudgetRecurringRow = {
  id: string;
  kind: BudgetKind;
  label: string;
  category: string | null;
  amountCents: number;
  frequency: BudgetFrequency;
  startsOn: string;
  endsOn: string | null;
  accountId: string | null;
  toAccountId: string | null;
  /** Dernier jour inscrit tout seul par l'ancien système : ce qui précède est réglé. */
  postedThrough: string | null;
  /** Le jour où il a été ajouté (fuseau UTC suffit : on n'en garde que le mois). */
  createdOn: string;
};

/** Le type de chaque compte, pour savoir ce qu'un virement change au budget. */
export type AccountTypes = ReadonlyMap<string, AccountType>;

/** Ce qu'il faut savoir d'une transaction pour connaître son effet sur le budget. */
export type MoneyMove = {
  kind: EntryKind;
  category: string | null;
  amountCents: number;
  accountId: string | null;
  toAccountId: string | null;
};

/**
 * L'effet d'une transaction sur le budget. L'épargne n'est pas une dépense :
 * c'est de l'argent gardé. Payer sa carte de crédit ne change rien (l'achat a déjà
 * compté) ; un paiement sur un prêt compte dans la catégorie Dettes.
 */
export function budgetEffect(
  move: MoneyMove,
  types: AccountTypes,
): { income: number; spent: number; saved: number; category: string | null } {
  const none = { income: 0, spent: 0, saved: 0, category: null };
  const cents = move.amountCents;
  switch (move.kind) {
    case "income":
      return { ...none, income: cents };
    case "adjustment":
      return none;
    case "expense":
    case "refund": {
      const signed = move.kind === "expense" ? cents : -cents;
      return move.category === "savings"
        ? { ...none, saved: signed, category: "savings" }
        : { ...none, spent: signed, category: move.category };
    }
    case "transfer": {
      const from = move.accountId ? types.get(move.accountId) : null;
      const to = move.toAccountId ? types.get(move.toAccountId) : null;
      if (isSavingsType(to) && !isSavingsType(from)) {
        return { ...none, saved: cents, category: "savings" };
      }
      if (isSavingsType(from) && !isSavingsType(to)) {
        return { ...none, saved: -cents, category: "savings" };
      }
      if (to === "loan" && from !== "loan") {
        return { ...none, spent: cents, category: "debt" };
      }
      return none;
    }
  }
}

/** Sépare les milliers des cents : le dernier séparateur est celui des cents. */
function normalizeNumber(value: string) {
  const text = value.replace(/[\s\u00a0\u202f$]/g, "");
  if (text.includes(",") && text.includes(".")) {
    return text.lastIndexOf(",") > text.lastIndexOf(".")
      ? text.replace(/\./g, "").replace(",", ".")
      : text.replace(/,/g, "");
  }
  return text.replace(",", ".");
}

/**
 * Montant saisi (« 12 », « 12,50 », « 1 250,50 », « 1,250.50 $ ») vers des
 * cents ; null s'il est invalide, nul ou trop grand.
 */
export function parseAmount(value: string): number | null {
  const text = normalizeNumber(value);
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  const cents = Math.round(Number(text) * 100);
  return cents >= 1 && cents <= BUDGET_AMOUNT_MAX_CENTS ? cents : null;
}

/** Limite d'un solde : plus de 20 millions de dollars ne tient pas dans la colonne. */
export const BALANCE_MAX_CENTS = 2_000_000_000;

/**
 * Montant signé (un solde, une ligne de relevé) : « -12,50 », « (12.50) », « 12.50- ».
 * Zéro est permis ; null s'il est invalide ou trop grand.
 */
export function parseSignedAmount(value: string): number | null {
  let text = normalizeNumber(value.trim());
  let negative = false;
  if (/^\(.*\)$/.test(text)) {
    negative = true;
    text = text.slice(1, -1);
  }
  if (text.endsWith("-")) {
    negative = true;
    text = text.slice(0, -1);
  }
  if (text.startsWith("-")) {
    negative = !negative;
    text = text.slice(1);
  }
  if (text.startsWith("+")) text = text.slice(1);
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  const cents = Math.round(Number(text) * 100);
  if (cents > BALANCE_MAX_CENTS) return null;
  return negative ? -cents : cents;
}

const error = (key: BudgetError) => ({ error: key });

const amountSchema = z
  .string(error("amountInvalid"))
  .transform((value, context) => {
    const cents = parseAmount(value);
    if (cents === null) {
      context.addIssue({ code: "custom", message: "amountInvalid" });
      return z.NEVER;
    }
    return cents;
  });

const optionalText = (max: number, key: BudgetError) =>
  z
    .string()
    .trim()
    .max(max, error(key))
    .optional()
    .transform((value) => value || null);

const categoryField = z
  .string()
  .optional()
  .transform((value) => value || null);

const optionalId = z
  .union([z.uuid(), z.literal("")])
  .optional()
  .transform((value) => value || null);

/** Une dépense demande une catégorie ; un revenu et un virement n'en gardent pas. */
function categoryOf(
  kind: EntryKind,
  value: string | null,
  context: z.RefinementCtx,
): string | null {
  if (kind !== "expense" && kind !== "refund") return null;
  if (!isCategoryKey(value)) {
    context.addIssue({
      code: "custom",
      path: ["category"],
      message: "categoryRequired",
    });
    return null;
  }
  return value;
}

/** Un virement va d'un compte à un autre. */
function checkTransfer(
  kind: EntryKind,
  accountId: string | null,
  toAccountId: string | null,
  context: z.RefinementCtx,
) {
  if (kind !== "transfer") return;
  if (!accountId) {
    context.addIssue({
      code: "custom",
      path: ["accountId"],
      message: "accountRequired",
    });
  }
  if (!toAccountId) {
    context.addIssue({
      code: "custom",
      path: ["toAccountId"],
      message: "accountRequired",
    });
  } else if (toAccountId === accountId) {
    context.addIssue({
      code: "custom",
      path: ["toAccountId"],
      message: "sameAccount",
    });
  }
}

const ENTRY_FIELDS = [
  "kind",
  "amount",
  "category",
  "note",
  "date",
  "accountId",
  "toAccountId",
] as const;
export type EntryField = (typeof ENTRY_FIELDS)[number];

/** Formulaire d'une transaction. */
export const entryFormSchema = z
  .object({
    kind: z.enum(
      ["expense", "income", "refund", "transfer"],
      error("unexpected"),
    ),
    amount: amountSchema,
    category: categoryField,
    note: optionalText(BUDGET_NOTE_MAX, "noteTooLong"),
    date: z.iso.date(error("dateInvalid")),
    accountId: optionalId,
    toAccountId: optionalId,
    goalId: optionalId,
  })
  .transform((input, context) => {
    checkTransfer(input.kind, input.accountId, input.toAccountId, context);
    const transfer = input.kind === "transfer";
    return {
      kind: input.kind,
      amountCents: input.amount,
      category: categoryOf(input.kind, input.category, context),
      note: input.note,
      occurredOn: input.date,
      accountId: input.accountId,
      toAccountId: transfer ? input.toAccountId : null,
      goalId: input.goalId,
    };
  });
export type EntryInput = z.output<typeof entryFormSchema>;

export function entryFieldErrors(zodError: z.ZodError) {
  return fieldErrorsFrom(zodError, ENTRY_FIELDS, isBudgetError, "unexpected");
}

const RECURRING_FIELDS = [
  "kind",
  "label",
  "amount",
  "category",
  "frequency",
  "startsOn",
  "endsOn",
  "accountId",
  "toAccountId",
] as const;
export type RecurringField = (typeof RECURRING_FIELDS)[number];

/** Formulaire d'un revenu, d'une dépense ou d'un virement fixe. */
export const recurringFormSchema = z
  .object({
    kind: z.enum(BUDGET_KINDS, error("unexpected")),
    label: z
      .string(error("labelRequired"))
      .trim()
      .min(1, error("labelRequired"))
      .max(BUDGET_LABEL_MAX, error("labelTooLong")),
    amount: amountSchema,
    category: categoryField,
    frequency: z.enum(BUDGET_FREQUENCIES, error("unexpected")),
    startsOn: z.iso.date(error("dateInvalid")),
    endsOn: z
      .union([z.iso.date(error("dateInvalid")), z.literal("")])
      .optional()
      .transform((value) => value || null),
    accountId: optionalId,
    toAccountId: optionalId,
  })
  .transform((input, context) => {
    checkTransfer(input.kind, input.accountId, input.toAccountId, context);
    if (input.endsOn !== null && input.endsOn < input.startsOn) {
      context.addIssue({
        code: "custom",
        path: ["endsOn"],
        message: "endBeforeStart",
      });
    }
    return {
      kind: input.kind,
      label: input.label,
      amountCents: input.amount,
      category: categoryOf(input.kind, input.category, context),
      frequency: input.frequency,
      startsOn: input.startsOn,
      endsOn: input.endsOn,
      accountId: input.accountId,
      toAccountId: input.kind === "transfer" ? input.toAccountId : null,
    };
  });
export type RecurringInput = z.output<typeof recurringFormSchema>;

export function recurringFieldErrors(zodError: z.ZodError) {
  return fieldErrorsFrom(
    zodError,
    RECURRING_FIELDS,
    isBudgetError,
    "unexpected",
  );
}

/** Vue lue dans l'adresse (?view=), le mois par défaut. */
export function parseView(value: unknown): BudgetView {
  return BUDGET_VIEWS.find((view) => view === value) ?? "month";
}

/** Jour lu dans l'adresse (?date=) ; null : aujourd'hui. */
export function parseDay(value: unknown): string | null {
  return typeof value === "string" && z.iso.date().safeParse(value).success
    ? value
    : null;
}

const daysInMonth = (year: number, month: number) =>
  new Date(Date.UTC(year, month, 0)).getUTCDate();

const pad = (value: number) => String(value).padStart(2, "0");

/** « AAAA-MM-JJ » d'une année, d'un mois (1 à 12) et d'un jour. */
const dayOf = (year: number, month: number, day: number) =>
  `${year}-${pad(month)}-${pad(day)}`;

/** Premier jour du mois, décalé de `months` mois. */
export function monthStart(day: string, months = 0) {
  const date = new Date(
    Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1 + months, 1),
  );
  return dayOf(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);
}

/** Premier et dernier jour de la période qui contient `day` (semaine du lundi au dimanche). */
export function periodOf(
  view: BudgetView,
  day: string,
): { start: string; end: string } {
  switch (view) {
    case "day":
      return { start: day, end: day };
    case "week": {
      const start = addDays(day, 1 - isoWeekday(day));
      return { start, end: addDays(start, 6) };
    }
    case "month":
      return { start: monthStart(day), end: addDays(monthStart(day, 1), -1) };
  }
}

/** Premier jour de la période précédente (-1) ou suivante (1). */
export function shiftPeriod(view: BudgetView, day: string, step: -1 | 1) {
  const { start } = periodOf(view, day);
  switch (view) {
    case "day":
      return addDays(start, step);
    case "week":
      return addDays(start, 7 * step);
    case "month":
      return monthStart(start, step);
  }
}

/**
 * Jours où tombe un revenu ou une dépense fixe entre `from` et `to` inclus.
 * Chaque mois et chaque année : le même jour que le premier, ou le dernier jour
 * d'un mois trop court (un loyer du 31 tombe le 30 novembre).
 */
export function occurrencesIn(
  rule: Pick<BudgetRecurringRow, "frequency" | "startsOn" | "endsOn">,
  from: string,
  to: string,
  limit = Number.POSITIVE_INFINITY,
): string[] {
  const start = from > rule.startsOn ? from : rule.startsOn;
  const end = rule.endsOn !== null && rule.endsOn < to ? rule.endsOn : to;
  const days: string[] = [];
  if (start > end) return days;
  const push = (day: string) => {
    if (day >= start && day <= end && days.length < limit) days.push(day);
  };

  switch (rule.frequency) {
    case "daily":
    case "weekly":
    case "biweekly": {
      const step =
        rule.frequency === "daily" ? 1 : rule.frequency === "weekly" ? 7 : 14;
      const offset = daysBetween(rule.startsOn, start) % step;
      for (
        let day = addDays(start, (step - offset) % step);
        day <= end && days.length < limit;
        day = addDays(day, step)
      ) {
        push(day);
      }
      break;
    }
    case "monthly": {
      const wanted = Number(rule.startsOn.slice(8));
      for (
        let month = monthStart(start);
        month <= end && days.length < limit;
        month = monthStart(month, 1)
      ) {
        const year = Number(month.slice(0, 4));
        const index = Number(month.slice(5, 7));
        push(dayOf(year, index, Math.min(wanted, daysInMonth(year, index))));
      }
      break;
    }
    case "yearly": {
      const index = Number(rule.startsOn.slice(5, 7));
      const wanted = Number(rule.startsOn.slice(8));
      for (
        let year = Number(start.slice(0, 4));
        year <= Number(end.slice(0, 4)) && days.length < limit;
        year++
      ) {
        push(dayOf(year, index, Math.min(wanted, daysInMonth(year, index))));
      }
      break;
    }
  }
  return days;
}

/** Prochain jour (aujourd'hui compris) où tombe un revenu ou une dépense fixe. */
export function nextOccurrence(
  rule: Pick<BudgetRecurringRow, "frequency" | "startsOn" | "endsOn">,
  today: string,
): string | null {
  return occurrencesIn(rule, today, addDays(today, 366), 1)[0] ?? null;
}

/** Équivalent par mois d'un montant fixe (« ≈ 5 417 $ par mois »). */
export function monthlyEquivalent(
  rule: Pick<BudgetRecurringRow, "frequency" | "amountCents">,
): number {
  const perYear = {
    daily: 365,
    weekly: 52,
    biweekly: 26,
    monthly: 12,
    yearly: 1,
  }[rule.frequency];
  return Math.round((rule.amountCents * perYear) / 12);
}

/**
 * Un paiement fixe pas encore réglé : à venir, ou arrivé sans être coché (une
 * paie pas encore confirmée). Voir `outstandingIn` dans checklist.ts.
 */
export type UpcomingItem = MoneyMove & {
  recurringId: string;
  label: string;
  /** « AAAA-MM-JJ ». */
  day: string;
  frequency: BudgetFrequency;
};

export type BudgetSummary = {
  /** Revenus reçus pendant la période. */
  incomeCents: number;
  /** Revenus fixes encore à venir ou à confirmer. */
  upcomingIncomeCents: number;
  /** Dépenses déjà sorties (remboursements retirés), fixes comprises. */
  spentCents: number;
  /** Dont celles qui viennent d'un montant fixe. */
  fixedSpentCents: number;
  /** Dépenses fixes encore à venir ou pas encore cochées. */
  upcomingCents: number;
  /** Mis de côté (l'épargne n'est pas une dépense). */
  savedCents: number;
  /** Épargne fixe encore à venir. */
  upcomingSavedCents: number;
  /** L'épargne prévue pas encore faite (elle n'est pas à dépenser). */
  reserveCents: number;
  /** Ce qui reste à dépenser : revenus prévus, moins tout ce qui sort, moins l'épargne prévue. */
  remainingCents: number;
  /** Dépenses par catégorie (sorties et à venir), la plus grosse d'abord. */
  categories: { category: string; cents: number }[];
  /** Jours qui restent dans la période, aujourd'hui compris (0 si elle est passée). */
  daysLeft: number;
  /** Ce qu'on peut encore dépenser par jour d'ici la fin (période en cours, reste positif). */
  perDayCents: number | null;
};

/** Le suivi d'une période : ce qui entre, ce qui sort, ce qui est gardé, ce qui reste. */
export function summarizeBudget({
  entries,
  upcoming,
  types,
  start,
  end,
  today,
  reserveCents = 0,
}: {
  entries: readonly (MoneyMove & {
    occurredOn: string;
    recurringId: string | null;
  })[];
  upcoming: readonly UpcomingItem[];
  types: AccountTypes;
  start: string;
  end: string;
  today: string;
  /** L'épargne prévue pas encore mise de côté. */
  reserveCents?: number;
}): BudgetSummary {
  let incomeCents = 0;
  let upcomingIncomeCents = 0;
  let spentCents = 0;
  let fixedSpentCents = 0;
  let upcomingCents = 0;
  let savedCents = 0;
  let upcomingSavedCents = 0;
  const byCategory = new Map<string, number>();
  const addCategory = (category: string | null, cents: number) => {
    const key = category ?? "other";
    byCategory.set(key, (byCategory.get(key) ?? 0) + cents);
  };

  for (const entry of entries) {
    if (entry.occurredOn < start || entry.occurredOn > end) continue;
    const effect = budgetEffect(entry, types);
    incomeCents += effect.income;
    savedCents += effect.saved;
    spentCents += effect.spent;
    if (entry.recurringId) fixedSpentCents += effect.spent;
    if (effect.spent !== 0) addCategory(effect.category, effect.spent);
  }
  for (const item of upcoming) {
    if (item.day < start || item.day > end) continue;
    const effect = budgetEffect(item, types);
    upcomingIncomeCents += effect.income;
    upcomingSavedCents += effect.saved;
    upcomingCents += effect.spent;
    if (effect.spent !== 0) addCategory(effect.category, effect.spent);
  }

  const remainingCents =
    incomeCents +
    upcomingIncomeCents -
    spentCents -
    upcomingCents -
    savedCents -
    upcomingSavedCents -
    reserveCents;
  const daysLeft =
    today > end ? 0 : daysBetween(today < start ? start : today, end) + 1;
  const current = today >= start && today <= end;
  return {
    incomeCents,
    upcomingIncomeCents,
    spentCents,
    fixedSpentCents,
    upcomingCents,
    savedCents,
    upcomingSavedCents,
    reserveCents,
    remainingCents,
    categories: [...byCategory]
      .map(([category, cents]) => ({ category, cents }))
      .filter((line) => line.cents > 0)
      .sort((a, b) => b.cents - a.cents),
    daysLeft,
    perDayCents:
      current && remainingCents > 0
        ? Math.floor(remainingCents / daysLeft)
        : null,
  };
}

/** Devise du budget : celle du pays du compte. */
export const currencyOf = (country: string | null) =>
  country === "US" ? "USD" : "CAD";
