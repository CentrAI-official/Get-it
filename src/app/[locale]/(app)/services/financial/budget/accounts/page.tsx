import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { BudgetSection } from "@/features/budget/components/budget-section";
import {
  AccountsLoader,
  AccountsSkeleton,
} from "@/features/budget/components/accounts-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Budget.tabs");
  return { title: t("accounts") };
}

// Financier › Budget › Comptes
export default function BudgetAccountsPage() {
  return (
    <BudgetSection current="accounts">
      <Suspense fallback={<AccountsSkeleton />}>
        <AccountsLoader />
      </Suspense>
    </BudgetSection>
  );
}
