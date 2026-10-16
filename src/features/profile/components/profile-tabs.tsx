import { useTranslations } from "next-intl";
import { SectionTabs } from "@/components/layout/section-tabs";

const TABS = [
  { key: "overview", href: "/profile" },
  { key: "goals", href: "/goals" },
  { key: "habits", href: "/habits" },
] as const;

export type ProfileTab = (typeof TABS)[number]["key"];

/** Sections de la catégorie Profil : aperçu, objectifs et habitudes. */
export function ProfileTabs({ current }: { current: ProfileTab }) {
  const t = useTranslations("App.profileTabs");

  return (
    <SectionTabs
      label={t("label")}
      current={current}
      tabs={TABS.map(({ key, href }) => ({ key, href, label: t(key) }))}
    />
  );
}
