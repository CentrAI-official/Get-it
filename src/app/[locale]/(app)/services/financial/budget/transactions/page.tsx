import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { BudgetSection } from "@/features/budget/components/budget-section";
import {
  TransactionsLoader,
  TransactionsSkeleton,
} from "@/features/budget/components/transactions-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Budget.tabs");
  return { title: t("transactions") };
}

// Financier › Budget › Transactions
export default function BudgetTransactionsPage({
  searchParams,
}: PageProps<"/[locale]/services/financial/budget/transactions">) {
  return (
    <BudgetSection current="transactions">
      <Suspense fallback={<TransactionsSkeleton />}>
        <TransactionsLoader searchParams={searchParams} />
      </Suspense>
    </BudgetSection>
  );
}
