import { Package } from "lucide-react";
import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { CategoryRow } from "@/features/marketplace/components/vitrine";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("App.marketplace.gear");
  return { title: t("title") };
}

// Marketplace › Gear : bientôt (vente de gear fermée pour l'instant)
export default function MarketplaceGearPage() {
  const t = useTranslations("App.marketplace.gear");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeader title={t("title")} description={t("question")} />
      <CategoryRow kind="service" current={undefined} onGear />
      <EmptyState
        icon={Package}
        title={t("soonTitle")}
        description={t("soonDescription")}
      />
    </div>
  );
}
