import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/layout/page-header";
import {
  MusicCatalogPanel,
  MusicCatalogSkeleton,
} from "@/features/stories/components/music-panels";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("MusicCatalog");
  return { title: t("title") };
}

export default function MusicCatalogPage() {
  const t = useTranslations("MusicCatalog");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <BackLink href="/settings" label={t("back")} />
      <PageHeader title={t("title")} description={t("description")} />
      <Suspense fallback={<MusicCatalogSkeleton />}>
        <MusicCatalogPanel />
      </Suspense>
    </div>
  );
}
