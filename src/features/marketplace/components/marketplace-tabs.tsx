import { useTranslations } from "next-intl";
import { SectionTabs } from "@/components/layout/section-tabs";

const TABS = [
  { key: "gear", href: "/marketplace" },
  { key: "services", href: "/marketplace/services" },
] as const;

/** Onglets de la Marketplace : Gear (produits) et Services (professionnels). */
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
