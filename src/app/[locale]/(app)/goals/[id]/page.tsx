import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { BackToGoals } from "@/features/goals/components/back-to-goals";
import {
  GoalDetail,
  GoalDetailSkeleton,
} from "@/features/goals/components/goal-detail";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Goals.detail");
  return { title: t("metaTitle") };
}

export default function GoalPage({
  params,
}: PageProps<"/[locale]/goals/[id]">) {
  return (
    <div className="flex flex-col gap-6">
      <BackToGoals />
      {/* L'id n'est connu qu'à la requête : lu dans le Suspense */}
      <Suspense fallback={<GoalDetailSkeleton />}>
        {params.then(({ id }) => (
          <GoalDetail goalId={id} />
        ))}
      </Suspense>
    </div>
  );
}
