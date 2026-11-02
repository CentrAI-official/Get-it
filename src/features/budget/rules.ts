import { z } from "zod";
import { addDays, daysBetween, isoWeekday } from "@/lib/dates";
import { fieldErrorsFrom } from "@/lib/form-errors";

// Financier › Budget (décision du fondateur, 2026-11-01) : revenus et dépenses
// fixes avec leur fréquence, mouvements au jour le jour, et le suivi par jour,
// semaine ou mois. Listes et limites alignées sur la migration
// 20261114120000_budget (un test le vérifie). Fonctions pures.

export const BUDGET_KINDS = ["income", "expense"] as const;
export type BudgetKind = (typeof BUDGET_KINDS)[number];

/** Catégories des dépenses (un revenu n'en a pas). */
export const BUDGET_CATEGORIES = [
  "housing",
  "groceries",
  "transport",
  "restaurants",
  "leisure",
  "subscriptions",
  "health",
  "debt",
  "savings",
  "other",
] as const;
export type BudgetCategory = (typeof BUDGET_CATEGORIES)[number];

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

/** Un mouvement au jour le jour, tel que l'affiche la page. */
export type BudgetEntryRow = {
  id: string;
  kind: BudgetKind;
  category: BudgetCategory | null;
  amountCents: number;
  note: string | null;
  /** « AAAA-MM-JJ ». */
  occurredOn: string;
};

/** Un revenu ou une dépense fixe. */
export type BudgetRecurringRow = {
  id: string;
  kind: BudgetKind;
  label: string;
  category: BudgetCategory | null;
  amountCents: number;
  frequency: BudgetFrequency;
  startsOn: string;
  endsOn: string | null;
};

/**
 * Montant saisi (« 12 », « 12,50 », « 1 250,50 », « 1,250.50 $ ») vers des
 * cents ; null s'il est invalide, nul ou trop grand.
 */
export function parseAmount(value: string): number | null {
  let text = value.replace(/[\s  $]/g, "");
  if (text.includes(",") && text.includes(".")) {
    // Le dernier séparateur est celui des cents, l'autre sépare les milliers
    text =
      text.lastIndexOf(",") > text.lastIndexOf(".")
        ? text.replace(/\./g, "").replace(",", ".")
        : text.replace(/,/g, "");
  } else {
    text = text.replace(",", ".");
  }
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  const cents = Math.round(Number(text) * 100);
  return cents >= 1 && cents <= BUDGET_AMOUNT_MAX_CENTS ? cents : null;
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

/** Une dépense demande une catégorie ; un revenu n'en garde pas. */
function categoryOf(
  kind: BudgetKind,
  value: string | null,
  context: z.RefinementCtx,
): BudgetCategory | null {
  if (kind === "income") return null;
  const category = BUDGET_CATEGORIES.find((entry) => entry === value);
  if (!category) {
    context.addIssue({
      code: "custom",
      path: ["category"],
      message: "categoryRequired",
    });
    return null;
  }
  return category;
}

const ENTRY_FIELDS = ["kind", "amount", "category", "note", "date"] as const;
export type EntryField = (typeof ENTRY_FIELDS)[number];

/** Formulaire d'une dépense ou d'un revenu au jour le jour. */
export const entryFormSchema = z
  .object({
    kind: z.enum(BUDGET_KINDS, error("unexpected")),
    amount: amountSchema,
    category: categoryField,
    note: optionalText(BUDGET_NOTE_MAX, "noteTooLong"),
    date: z.iso.date(error("dateInvalid")),
  })
  .transform((input, context) => ({
    kind: input.kind,
    amountCents: input.amount,
    category: categoryOf(input.kind, input.category, context),
    note: input.note,
    occurredOn: input.date,
  }));
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
] as const;
export type RecurringField = (typeof RECURRING_FIELDS)[number];

/** Formulaire d'un revenu ou d'une dépense fixe. */
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
  })
  .transform((input, context) => {
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
function monthStart(day: string, months = 0) {
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

export type BudgetSummary = {
  /** Revenus fixes et ponctuels de la période. */
  incomeCents: number;
  /** Dépenses fixes de la période (le prévu). */
  fixedCents: number;
  /** Dépenses au jour le jour de la période. */
  spentCents: number;
  /** Revenus moins toutes les dépenses (négatif : dépassement). */
  remainingCents: number;
  /** Dépenses fixes encore à venir dans la période (après aujourd'hui). */
  upcomingFixedCents: number;
  /** Dépenses par catégorie (fixes et au jour le jour), la plus grosse d'abord. */
  categories: { category: BudgetCategory; cents: number }[];
  /** Jours qui restent dans la période, aujourd'hui compris (0 si elle est passée). */
  daysLeft: number;
  /** Ce qu'on peut encore dépenser par jour d'ici la fin (période en cours, reste positif). */
  perDayCents: number | null;
};

/** Le suivi d'une période : ce qui entre, ce qui est prévu, ce qui est dépensé, ce qui reste. */
export function summarizeBudget({
  entries,
  recurring,
  start,
  end,
  today,
}: {
  entries: BudgetEntryRow[];
  recurring: BudgetRecurringRow[];
  start: string;
  end: string;
  today: string;
}): BudgetSummary {
  let incomeCents = 0;
  let fixedCents = 0;
  let spentCents = 0;
  let upcomingFixedCents = 0;
  const byCategory = new Map<BudgetCategory, number>();
  const addCategory = (category: BudgetCategory | null, cents: number) => {
    const key = category ?? "other";
    byCategory.set(key, (byCategory.get(key) ?? 0) + cents);
  };

  for (const rule of recurring) {
    const days = occurrencesIn(rule, start, end);
    const total = rule.amountCents * days.length;
    if (rule.kind === "income") {
      incomeCents += total;
    } else if (total > 0) {
      fixedCents += total;
      upcomingFixedCents +=
        rule.amountCents * days.filter((day) => day > today).length;
      addCategory(rule.category, total);
    }
  }
  for (const entry of entries) {
    if (entry.occurredOn < start || entry.occurredOn > end) continue;
    if (entry.kind === "income") {
      incomeCents += entry.amountCents;
    } else {
      spentCents += entry.amountCents;
      addCategory(entry.category, entry.amountCents);
    }
  }

  const remainingCents = incomeCents - fixedCents - spentCents;
  const daysLeft =
    today > end ? 0 : daysBetween(today < start ? start : today, end) + 1;
  const current = today >= start && today <= end;
  return {
    incomeCents,
    fixedCents,
    spentCents,
    remainingCents,
    upcomingFixedCents,
    categories: [...byCategory]
      .map(([category, cents]) => ({ category, cents }))
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
