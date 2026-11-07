import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { BudgetSection } from "@/features/budget/components/budget-section";
import {
  ReportsLoader,
  ReportsSkeleton,
} from "@/features/budget/components/reports-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Budget.tabs");
  return { title: t("reports") };
}

// Financier › Budget › Rapports
export default function BudgetReportsPage({
  searchParams,
}: PageProps<"/[locale]/services/financial/budget/reports">) {
  return (
    <BudgetSection current="reports">
      <Suspense fallback={<ReportsSkeleton />}>
        <ReportsLoader searchParams={searchParams} />
      </Suspense>
    </BudgetSection>
  );
}
