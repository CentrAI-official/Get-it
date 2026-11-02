import type { createFormatter } from "next-intl";
import type { BudgetKind } from "./rules";

// Montants du budget, partagés par la page (serveur) et ses fenêtres (client).

/** Le formateur de next-intl (useFormatter, getFormatter). */
type NumberFormatter = Pick<ReturnType<typeof createFormatter>, "number">;

/** « 1 250,50 $ » ; `signed` ajoute « + » à un revenu et « − » à une dépense. */
export function formatMoney(
  format: NumberFormatter,
  cents: number,
  currency: string,
  signed?: BudgetKind,
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

/** Montant en cents → valeur d'un champ (« 12,50 » en français, « 12.50 » en anglais). */
export function amountField(cents: number, locale: string) {
  const text = (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);
  return locale === "fr" ? text.replace(".", ",") : text;
}
