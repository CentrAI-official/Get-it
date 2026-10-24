import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import {
  CatalogPanel,
  CatalogSkeleton,
} from "@/features/marketplace/components/marketplace-panels";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("App.marketplace.gear");
  return { title: t("title") };
}

// Marketplace › Gear : vêtements, équipement, livres
export default function MarketplaceGearPage({
  searchParams,
}: PageProps<"/[locale]/marketplace/gear">) {
  const t = useTranslations("App.marketplace.gear");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeader title={t("title")} description={t("question")} />
      <Suspense fallback={<CatalogSkeleton />}>
        <CatalogPanel kind="gear" searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
