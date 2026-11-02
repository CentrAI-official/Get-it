import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/layout/page-header";
import { SectionTabs } from "@/components/layout/section-tabs";

// Sections de Mon développement (décision du fondateur, 2026-11-01) : chacune
// a son plan et sa bibliothèque ou son outil, en onglets.

type Tab = { key: string; href: `/${string}` };

const SECTIONS = {
  physical: { back: "/services", tabs: [] },
  training: {
    back: "/services/physical",
    tabs: [
      { key: "plan", href: "/services/physical/training" },
      { key: "exercises", href: "/services/physical/training/exercises" },
    ],
  },
  nutrition: {
    back: "/services/physical",
    tabs: [
      { key: "plan", href: "/services/physical/nutrition" },
      { key: "recipes", href: "/services/physical/nutrition/recipes" },
    ],
  },
  mental: {
    back: "/services",
    tabs: [
      { key: "plan", href: "/services/mental" },
      { key: "tools", href: "/services/mental/tools" },
    ],
  },
  social: {
    back: "/services",
    tabs: [
      { key: "plan", href: "/services/social" },
      { key: "tools", href: "/services/social/tools" },
    ],
  },
  financial: {
    back: "/services",
    tabs: [
      { key: "plan", href: "/services/financial" },
      { key: "budget", href: "/services/financial/budget" },
    ],
  },
} as const satisfies Record<string, { back: `/${string}`; tabs: Tab[] }>;

export type DevelopmentSectionKey = keyof typeof SECTIONS;

/** En-tête d'une section : retour, titre et onglets (Mon plan, Exercices…). */
export function DevelopmentSection({
  section,
  current,
  children,
}: {
  section: DevelopmentSectionKey;
  /** Onglet ouvert (« plan », « exercises »…). */
  current?: string;
  children: ReactNode;
}) {
  const t = useTranslations("Development.section");
  const { back, tabs } = SECTIONS[section];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-4">
        <BackLink
          href={back}
          label={back === "/services" ? t("back") : t("physical.title")}
        />
        <PageHeader
          title={t(`${section}.title`)}
          description={t(`${section}.description`)}
        />
      </div>
      {tabs.length > 0 && current ? (
        <SectionTabs
          label={t("tabsLabel", { section: t(`${section}.title`) })}
          current={current}
          tabs={tabs.map(({ key, href }) => ({
            key,
            href,
            label: t(`tabs.${key}`),
          }))}
        />
      ) : null}
      {children}
    </div>
  );
}
