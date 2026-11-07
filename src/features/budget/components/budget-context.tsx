"use client";

import { useTranslations } from "next-intl";
import { createContext, useContext, type ReactNode } from "react";
import type { BudgetAccountRow } from "../accounts";
import type { CategoryInfo } from "../categories";
import { categoryName } from "../labels";

/** Ce que toutes les fenêtres du budget ont besoin de connaître. */
export type BudgetContextValue = {
  categories: CategoryInfo[];
  accounts: BudgetAccountRow[];
  goals: { id: string; name: string }[];
  today: string;
  currency: string;
};

const BudgetContext = createContext<BudgetContextValue | null>(null);

export function BudgetProvider({
  value,
  children,
}: {
  value: BudgetContextValue;
  children: ReactNode;
}) {
  return (
    <BudgetContext.Provider value={value}>{children}</BudgetContext.Provider>
  );
}

export function useBudget() {
  const value = useContext(BudgetContext);
  if (!value) throw new Error("useBudget hors de BudgetProvider");
  return value;
}

/** Le nom d'une catégorie, dans la langue de la personne. */
export function useCategoryName() {
  const t = useTranslations("Budget");
  const { categories } = useBudget();
  return (key: string | null) => categoryName(t, categories, key);
}
