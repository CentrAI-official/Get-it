import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { BudgetSection } from "@/features/budget/components/budget-section";
import {
  GoalsLoader,
  GoalsSkeleton,
} from "@/features/budget/components/goals-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Budget.tabs");
  return { title: t("goals") };
}

// Financier › Budget › Objectifs (épargne et dettes)
export default function BudgetGoalsPage() {
  return (
    <BudgetSection current="goals">
      <Suspense fallback={<GoalsSkeleton />}>
        <GoalsLoader />
      </Suspense>
    </BudgetSection>
  );
}
