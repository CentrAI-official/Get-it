import { useTranslations } from "next-intl";
import { SectionTabs } from "@/components/layout/section-tabs";

const TABS = [
  { key: "services", href: "/marketplace" },
  { key: "gear", href: "/marketplace/gear" },
] as const;

/** Onglets de la Marketplace : Services (professionnels) et Gear (produits). */
export function MarketplaceTabs({
  current,
}: {
  current: (typeof TABS)[number]["key"];
}) {
  const t = useTranslations("App.marketplace.tabs");

  return (
    <SectionTabs
      label={t("label")}
      current={current}
      tabs={TABS.map(({ key, href }) => ({ key, href, label: t(key) }))}
    />
  );
}
