import { ShoppingBag } from "lucide-react";
import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { ComingSoon } from "@/components/layout/coming-soon";
import { MarketplaceTabs } from "@/features/marketplace/components/marketplace-tabs";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("App.marketplace.gear");
  return { title: t("title") };
}

// Marketplace › Gear : vêtements, équipement, livres (lot à venir)
export default function MarketplaceGearPage() {
  const t = useTranslations("App.marketplace.gear");

  return (
    <ComingSoon
      title={t("title")}
      description={t("question")}
      icon={ShoppingBag}
      soonTitle={t("soonTitle")}
      soonDescription={t("soonDescription")}
      tabs={<MarketplaceTabs current="gear" />}
    />
  );
}
