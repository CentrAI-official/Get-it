import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { createGoalAction } from "@/features/goals/actions";
import { BackToGoals } from "@/features/goals/components/back-to-goals";
import { GoalForm } from "@/features/goals/components/goal-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Goals.form");
  return { title: t("newTitle") };
}

export default function NewGoalPage() {
  const t = useTranslations("Goals.form");

  return (
    <div className="flex flex-col gap-8">
      <BackToGoals />
      <PageHeader title={t("newTitle")} description={t("newDescription")} />
      <GoalForm
        action={createGoalAction}
        submitLabel={t("create")}
        pendingLabel={t("creating")}
        cancelHref="/goals"
      />
    </div>
  );
}
