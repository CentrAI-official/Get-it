import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { ActiveGoals } from "@/features/goals/components/active-goals";
import { GoalListSkeleton } from "@/features/goals/components/goal-list";
import {
  TodayDashboard,
  TodayDashboardSkeleton,
} from "@/features/today/components/today-dashboard";
import { Link } from "@/i18n/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("App.today");
  return { title: t("title") };
}

export default function TodayPage() {
  const t = useTranslations("App.today");

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      {/* Salutation, niveau, orbite et quêtes : tout dépend de la session */}
      <Suspense fallback={<TodayDashboardSkeleton />}>
        <TodayDashboard />
      </Suspense>

      <section aria-labelledby="today-goals" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="today-goals" className="font-heading text-lg font-bold">
            {t("goalsTitle")}
          </h2>
          <Link
            href="/goals"
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            {t("goalsLink")}
          </Link>
        </div>
        <Suspense fallback={<GoalListSkeleton />}>
          <ActiveGoals />
        </Suspense>
      </section>
    </div>
  );
}
