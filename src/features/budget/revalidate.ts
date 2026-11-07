import "server-only";
import { refresh, revalidatePath } from "next/cache";

/** Toutes les pages du budget : un changement les concerne toutes. */
const BUDGET_PAGES = [
  "/[locale]/services/financial/budget",
  "/[locale]/services/financial/budget/transactions",
  "/[locale]/services/financial/budget/bills",
  "/[locale]/services/financial/budget/accounts",
  "/[locale]/services/financial/budget/goals",
  "/[locale]/services/financial/budget/reports",
] as const;

/** Rafraîchit la page ouverte et oublie les autres. */
export function revalidateBudget() {
  for (const page of BUDGET_PAGES) revalidatePath(page, "page");
  refresh();
}
