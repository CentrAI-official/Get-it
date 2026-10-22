import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import {
  DevelopmentHub,
  DevelopmentHubSkeleton,
} from "@/features/development/components/development-panels";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("App.services");
  return { title: t("title") };
}

// Mon développement : plans personnalisés par Get iT AI, puis le suivi par
// des professionnels (à venir)
export default function DevelopmentPage() {
  const t = useTranslations("App.services");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeader title={t("title")} description={t("question")} />
      <Suspense fallback={<DevelopmentHubSkeleton />}>
        <DevelopmentHub />
      </Suspense>
    </div>
  );
}
