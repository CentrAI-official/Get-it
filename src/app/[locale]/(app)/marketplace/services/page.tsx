import { Store } from "lucide-react";
import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { ComingSoon } from "@/components/layout/coming-soon";
import { MarketplaceTabs } from "@/features/marketplace/components/marketplace-tabs";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("App.marketplace.services");
  return { title: t("title") };
}

// Marketplace › Services : professionnels vérifiés (lot à venir)
export default function MarketplaceServicesPage() {
  const t = useTranslations("App.marketplace.services");

  return (
    <ComingSoon
      title={t("title")}
      description={t("question")}
      icon={Store}
      soonTitle={t("soonTitle")}
      soonDescription={t("soonDescription")}
      tabs={<MarketplaceTabs current="services" />}
    />
  );
}
