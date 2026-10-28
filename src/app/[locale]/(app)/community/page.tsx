import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
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
      {/* Pas de titre visible : la page commence par les stories */}
      <h1 className="sr-only">{t("title")}</h1>
      <Suspense fallback={<CommunityPanelSkeleton />}>
        <CommunityPanel searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
