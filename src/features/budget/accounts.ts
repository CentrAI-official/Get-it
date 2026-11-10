import { z } from "zod";
import { fieldErrorsFrom } from "@/lib/form-errors";
import { isBudgetError, parseSignedAmount, type BudgetError } from "./rules";

// Les comptes du budget : ce qu'on a et ce qu'on doit, entrés à la main ou par un
// fichier de la banque (jamais de connexion à la banque). Fonctions pures. Listes
// et limites alignées sur la migration 20261118120000_budget_complete.

export const ACCOUNT_TYPES = [
  "chequing",
  "savings",
  "cash",
  "investment",
  "property",
  "credit",
  "loan",
] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const ACCOUNT_NAME_MAX = 40;
export const MAX_ACCOUNTS = 30;
/** Taux annuel d'une dette, en centièmes de pour cent : 100 % au plus. */
export const RATE_MAX_BP = 10_000;

/** Une dette : son solde est négatif. */
export const isDebtType = (type: AccountType) =>
  type === "credit" || type === "loan";
/** L'argent qui y entre est de l'épargne. */
export const isSavingsType = (type: AccountType | null | undefined) =>
  type === "savings" || type === "investment";

export type BudgetAccountRow = {
  id: string;
  name: string;
  type: AccountType;
  /** Solde à `openedOn`, signé : une dette est négative. */
  openingCents: number;
  openedOn: string;
  rateBp: number | null;
  minimumCents: number | null;
  /** Le jour du mois où le paiement d'une dette est dû (1 à 31). */
  paymentDay: number | null;
};

/** Ce qui a changé dans un compte pendant un mois (« AAAA-MM »). */
export type AccountDelta = {
  accountId: string;
  month: string;
  cents: number;
};

/** Le solde d'aujourd'hui : l'ouverture, plus tout ce qui a bougé depuis. */
export function balanceOf(
  account: Pick<BudgetAccountRow, "id" | "openingCents">,
  deltas: readonly AccountDelta[],
) {
  return deltas.reduce(
    (total, delta) =>
      delta.accountId === account.id ? total + delta.cents : total,
    account.openingCents,
  );
}

/** Valeur nette : ce qu'on a, moins ce qu'on doit. */
export function netWorthOf(
  accounts: readonly Pick<BudgetAccountRow, "id" | "openingCents">[],
  deltas: readonly AccountDelta[],
) {
  let assetsCents = 0;
  let debtsCents = 0;
  for (const account of accounts) {
    const balance = balanceOf(account, deltas);
    if (balance >= 0) assetsCents += balance;
    else debtsCents -= balance;
  }
  return { assetsCents, debtsCents, netCents: assetsCents - debtsCents };
}

/**
 * La valeur nette à la fin de chaque mois (« AAAA-MM », dans l'ordre). Un mois
 * d'avant le premier compte n'a pas de valeur : la courbe commence à ce moment.
 */
export function netWorthSeries(
  accounts: readonly Pick<
    BudgetAccountRow,
    "id" | "openingCents" | "openedOn"
  >[],
  deltas: readonly AccountDelta[],
  months: readonly string[],
): { month: string; cents: number }[] {
  const series: { month: string; cents: number }[] = [];
  for (const month of months) {
    const open = accounts.filter(
      (account) => account.openedOn.slice(0, 7) <= month,
    );
    if (open.length === 0) continue;
    const ids = new Set(open.map((account) => account.id));
    const moved = deltas.reduce(
      (total, delta) =>
        ids.has(delta.accountId) && delta.month <= month
          ? total + delta.cents
          : total,
      0,
    );
    const opening = open.reduce(
      (total, account) => total + account.openingCents,
      0,
    );
    series.push({ month, cents: opening + moved });
  }
  return series;
}

/** Taux tapé (« 19,99 », « 19.99 % ») → centièmes de pour cent ; null s'il est invalide. */
export function parseRate(value: string): number | null {
  const text = value.replace(/[\s%]/g, "").replace(",", ".");
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(text)) return null;
  const rate = Math.round(Number(text) * 100);
  return rate <= RATE_MAX_BP ? rate : null;
}

/** Un montant facultatif, jamais négatif (le paiement minimum). */
function optionalPositive(value: string) {
  if (!value.trim()) return null;
  const cents = parseSignedAmount(value);
  return cents !== null && cents >= 0 ? cents : undefined;
}

const error = (key: BudgetError) => ({ error: key });

/** Le jour du paiement d'une dette : de 1 à 31 (un 31 tombe le 30 d'un mois court). */
export const PAYMENT_DAY_MAX = 31;

/** Jour tapé (« 15 ») ; null s'il est vide, undefined s'il est invalide. */
export function parsePaymentDay(value: string): number | null | undefined {
  const text = value.trim();
  if (!text) return null;
  if (!/^\d{1,2}$/.test(text)) return undefined;
  const day = Number(text);
  return day >= 1 && day <= PAYMENT_DAY_MAX ? day : undefined;
}

const ACCOUNT_FIELDS = [
  "name",
  "type",
  "balance",
  "date",
  "rate",
  "minimum",
  "paymentDay",
  "payFrom",
] as const;
export type AccountField = (typeof ACCOUNT_FIELDS)[number];

/** Formulaire d'un compte. Une dette se tape en positif : c'est ce qu'on doit. */
export const accountFormSchema = z
  .object({
    name: z
      .string(error("labelRequired"))
      .trim()
      .min(1, error("labelRequired"))
      .max(ACCOUNT_NAME_MAX, error("labelTooLong")),
    type: z.enum(ACCOUNT_TYPES, error("unexpected")),
    balance: z.string(error("amountInvalid")),
    date: z.iso.date(error("dateInvalid")),
    rate: z.string().optional().default(""),
    minimum: z.string().optional().default(""),
    paymentDay: z.string().optional().default(""),
  })
  .transform((input, context) => {
    const balance = parseSignedAmount(input.balance);
    if (balance === null) {
      context.addIssue({
        code: "custom",
        path: ["balance"],
        message: "amountInvalid",
      });
    }
    const debt = isDebtType(input.type);
    let rateBp: number | null = null;
    if (debt && input.rate.trim()) {
      rateBp = parseRate(input.rate);
      if (rateBp === null) {
        context.addIssue({
          code: "custom",
          path: ["rate"],
          message: "rateInvalid",
        });
      }
    }
    const minimum = debt ? optionalPositive(input.minimum) : null;
    if (minimum === undefined) {
      context.addIssue({
        code: "custom",
        path: ["minimum"],
        message: "amountInvalid",
      });
    }
    const paymentDay = debt ? parsePaymentDay(input.paymentDay) : null;
    if (paymentDay === undefined) {
      context.addIssue({
        code: "custom",
        path: ["paymentDay"],
        message: "dayInvalid",
      });
    }
    return {
      name: input.name,
      type: input.type,
      openingCents: debt ? -Math.abs(balance ?? 0) : (balance ?? 0),
      openedOn: input.date,
      rateBp,
      minimumCents: minimum ?? null,
      paymentDay: paymentDay ?? null,
    };
  });
export type AccountInput = z.output<typeof accountFormSchema>;

export function accountFieldErrors(zodError: z.ZodError) {
  return fieldErrorsFrom(zodError, ACCOUNT_FIELDS, isBudgetError, "unexpected");
}
