import { z } from "zod";
import { BUDGET_LABEL_MAX, BUDGET_AMOUNT_MAX_CENTS } from "./rules";
import { BUDGET_CATEGORIES, isCategoryKey } from "./categories";

// La mise en route du budget : le revenu, les paiements fixes habituels, puis une
// première répartition (voir `suggestPlan`). Tout se change ensuite.

/** Les paiements proposés à la deuxième étape. */
export const COMMON_BILLS = [
  { key: "rent", category: "housing" },
  { key: "electricity", category: "utilities" },
  { key: "phone", category: "phone" },
  { key: "internet", category: "phone" },
  { key: "insurance", category: "insurance" },
  { key: "car", category: "transport" },
  { key: "subscriptions", category: "subscriptions" },
] as const satisfies readonly {
  key: string;
  category: (typeof BUDGET_CATEGORIES)[number];
}[];

export const SETUP_FREQUENCIES = ["weekly", "biweekly", "monthly"] as const;

const cents = z.number().int().min(1).max(BUDGET_AMOUNT_MAX_CENTS);
const label = z.string().trim().min(1).max(BUDGET_LABEL_MAX);

/** Ce que le navigateur envoie à la fin : revalidé par le serveur. */
export const setupSchema = z.strictObject({
  income: z.strictObject({
    label,
    amountCents: cents,
    frequency: z.enum(SETUP_FREQUENCIES),
    startsOn: z.iso.date(),
  }),
  bills: z
    .array(
      z.strictObject({
        label,
        category: z.enum(BUDGET_CATEGORIES),
        amountCents: cents,
        startsOn: z.iso.date(),
      }),
    )
    .max(COMMON_BILLS.length),
  plans: z
    .array(
      z.strictObject({
        category: z.string().refine(isCategoryKey),
        amountCents: cents,
      }),
    )
    .max(BUDGET_CATEGORIES.length),
});
export type SetupInput = z.output<typeof setupSchema>;

/**
 * Le revenu du mois le plus court : 2 paies aux deux semaines, 4 chaque semaine.
 * Un mois à 3 (ou 5) paies arrive deux fois par année : c'est un bonus, pas un
 * revenu sur lequel bâtir son plan.
 */
export function monthlyIncome(
  amountCents: number,
  frequency: (typeof SETUP_FREQUENCIES)[number],
) {
  return amountCents * { weekly: 4, biweekly: 2, monthly: 1 }[frequency];
}
