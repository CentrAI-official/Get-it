import type { createFormatter } from "next-intl";
import type { EntryKind } from "./rules";

// Montants du budget, partagés par la page (serveur) et ses fenêtres (client).

/** Le formateur de next-intl (useFormatter, getFormatter). */
type NumberFormatter = Pick<ReturnType<typeof createFormatter>, "number">;

/** « 1 250,50 $ » ; `signed` ajoute « + » à ce qui entre et « − » à ce qui sort. */
export function formatMoney(
  format: NumberFormatter,
  cents: number,
  currency: string,
  signed?: "income" | "expense",
) {
  const text = format.number(Math.abs(cents) / 100, {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  const minus = signed === "expense" || (!signed && cents < 0);
  return minus ? `−${text}` : signed === "income" ? `+${text}` : text;
}

/** Anton n'a pas l'espace fine des milliers : espace insécable pour les grands chiffres. */
export const displayMoney = (text: string) => text.replace(/ /g, " ");

/** Le signe d'une transaction : un virement ou une épargne n'entre ni ne sort du budget. */
export function entrySign(
  kind: EntryKind,
  cents: number,
  category: string | null = null,
): "income" | "expense" | undefined {
  if (category === "savings") return undefined;
  switch (kind) {
    case "income":
    case "refund":
      return "income";
    case "expense":
      return "expense";
    case "adjustment":
      return cents < 0 ? "expense" : "income";
    case "transfer":
      return undefined;
  }
}

/** Montant en cents → valeur d'un champ (« 12,50 » en français, « 12.50 » en anglais). */
export function amountField(cents: number, locale: string) {
  const text = (Math.abs(cents) / 100).toFixed(cents % 100 === 0 ? 0 : 2);
  return locale === "fr" ? text.replace(".", ",") : text;
}
