import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { BackButton } from "@/components/back-button";
import { PageHeader } from "@/components/layout/page-header";
import {
  CoachPanel,
  CoachPanelSkeleton,
} from "@/features/coach/components/coach-panel";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("App.coach");
  return { title: t("title") };
}

export default function CoachPage() {
  const t = useTranslations("App.coach");
  const tCommon = useTranslations("Common");

  return (
    <div className="flex flex-col gap-6">
      <BackButton fallback="/community" label={tCommon("back")} />
      <PageHeader title={t("title")} description={t("question")} />
      <Suspense fallback={<CoachPanelSkeleton />}>
        <CoachPanel />
      </Suspense>
    </div>
  );
}
