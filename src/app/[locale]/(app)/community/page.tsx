import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import {
  CommunityPanel,
  CommunityPanelSkeleton,
} from "@/features/community/components/community-panel";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("App.community");
  return { title: t("title") };
}

export default function CommunityPage({
  searchParams,
}: PageProps<"/[locale]/community">) {
  const t = useTranslations("App.community");

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <PageHeader title={t("title")} description={t("question")} />
      <Suspense fallback={<CommunityPanelSkeleton />}>
        <CommunityPanel searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
