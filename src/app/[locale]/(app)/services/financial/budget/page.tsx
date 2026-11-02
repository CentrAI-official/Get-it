import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import {
  BudgetLoader,
  BudgetSkeleton,
} from "@/features/budget/components/budget-view";
import { DevelopmentSection } from "@/features/development/components/development-section";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Development.section");
  return { title: t("financial.title") };
}

// Financier › Budget
export default function BudgetPage({
  searchParams,
}: PageProps<"/[locale]/services/financial/budget">) {
  return (
    <DevelopmentSection section="financial" current="budget">
      <Suspense fallback={<BudgetSkeleton />}>
        <BudgetLoader searchParams={searchParams} />
      </Suspense>
    </DevelopmentSection>
  );
}
