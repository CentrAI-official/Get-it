import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { ActiveGoals } from "@/features/goals/components/active-goals";
import { GoalListSkeleton } from "@/features/goals/components/goal-list";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("App.goals");
  return { title: t("title") };
}

export default function GoalsPage() {
  const t = useTranslations("App.goals");

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t("title")} description={t("question")} />
      <section aria-labelledby="goals-active" className="flex flex-col gap-4">
        <h2 id="goals-active" className="font-heading text-lg font-semibold">
          {t("listTitle")}
        </h2>
        <Suspense fallback={<GoalListSkeleton />}>
          <ActiveGoals />
        </Suspense>
      </section>
    </div>
  );
}
