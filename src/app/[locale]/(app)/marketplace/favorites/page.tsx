import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/layout/page-header";
import {
  CatalogSkeleton,
  FavoritesPanel,
} from "@/features/marketplace/components/marketplace-panels";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("App.marketplace.favorites");
  return { title: t("title") };
}

// Marketplace › Mes favoris : les annonces gardées, privées
export default function FavoritesPage() {
  const t = useTranslations("App.marketplace.favorites");
  const tDetail = useTranslations("Marketplace.detail");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <BackLink href="/marketplace" label={tDetail("back")} />
      <PageHeader title={t("title")} description={t("question")} />
      <Suspense fallback={<CatalogSkeleton />}>
        <FavoritesPanel />
      </Suspense>
    </div>
  );
}
