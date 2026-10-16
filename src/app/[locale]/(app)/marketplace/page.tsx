import { ShoppingBag } from "lucide-react";
import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/layout/page-header";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("App.marketplace");
  return { title: t("title") };
}

// Catégorie en construction : son contenu arrive dans un prochain lot
export default function MarketplacePage() {
  const t = useTranslations("App.marketplace");

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t("title")} description={t("question")} />
      <EmptyState
        icon={ShoppingBag}
        title={t("soonTitle")}
        description={t("soonDescription")}
      />
    </div>
  );
}
