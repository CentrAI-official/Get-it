import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { BackToGoals } from "@/features/goals/components/back-to-goals";
import { GoalEditForm } from "@/features/goals/components/goal-edit-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Goals.form");
  return { title: t("editTitle") };
}

export default function EditGoalPage({
  params,
}: PageProps<"/[locale]/goals/[id]/edit">) {
  const t = useTranslations("Goals.form");

  return (
    <div className="flex flex-col gap-8">
      <BackToGoals />
      <PageHeader title={t("editTitle")} description={t("editDescription")} />
      {/* L'id n'est connu qu'à la requête : lu dans le Suspense */}
      <Suspense fallback={<Skeleton className="h-96 max-w-2xl rounded-xl" />}>
        {params.then(({ id }) => (
          <GoalEditForm goalId={id} />
        ))}
      </Suspense>
    </div>
  );
}
