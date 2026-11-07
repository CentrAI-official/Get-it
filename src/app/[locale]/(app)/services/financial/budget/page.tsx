import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { BudgetSection } from "@/features/budget/components/budget-section";
import {
  BudgetLoader,
  BudgetSkeleton,
} from "@/features/budget/components/budget-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Budget.tabs");
  return { title: t("month") };
}

// Financier › Budget : le mois
export default function BudgetPage({
  searchParams,
}: PageProps<"/[locale]/services/financial/budget">) {
  return (
    <BudgetSection current="month">
      <Suspense fallback={<BudgetSkeleton />}>
        <BudgetLoader searchParams={searchParams} />
      </Suspense>
    </BudgetSection>
  );
}
