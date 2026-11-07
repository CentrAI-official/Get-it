import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { BudgetSection } from "@/features/budget/components/budget-section";
import {
  BillsLoader,
  BillsSkeleton,
} from "@/features/budget/components/bills-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Budget.tabs");
  return { title: t("bills") };
}

// Financier › Budget › Factures
export default function BudgetBillsPage({
  searchParams,
}: PageProps<"/[locale]/services/financial/budget/bills">) {
  return (
    <BudgetSection current="bills">
      <Suspense fallback={<BillsSkeleton />}>
        <BillsLoader searchParams={searchParams} />
      </Suspense>
    </BudgetSection>
  );
}
