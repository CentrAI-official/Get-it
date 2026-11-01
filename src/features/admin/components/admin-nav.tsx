"use client";

import {
  ChartNoAxesColumn,
  LayoutDashboard,
  LayoutGrid,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { SectionTabs } from "@/components/layout/section-tabs";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const PAGES = [
  { key: "overview", href: "/admin", icon: LayoutDashboard },
  { key: "sections", href: "/admin/sections", icon: LayoutGrid },
  { key: "features", href: "/admin/features", icon: ChartNoAxesColumn },
  { key: "retention", href: "/admin/retention", icon: RotateCcw },
  { key: "ai", href: "/admin/ai", icon: Sparkles },
  { key: "audit", href: "/admin/audit", icon: ShieldCheck },
] as const satisfies readonly {
  key: string;
  href: `/${string}`;
  icon: LucideIcon;
}[];

function useCurrentPage() {
  const pathname = usePathname();
  return (
    [...PAGES].reverse().find(({ href }) => pathname.startsWith(href))?.key ??
    "overview"
  );
}

/** Pages du dashboard sur ordinateur : une colonne d'icônes et de noms. */
export function AdminSideNav() {
  const t = useTranslations("Admin.nav");
  const current = useCurrentPage();

  return (
    <nav aria-label={t("label")}>
      <ul className="flex flex-col gap-1">
        {PAGES.map(({ key, href, icon: Icon }) => {
          const active = key === current;
          return (
            <li key={key}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  active
                    ? "bg-primary/12 text-foreground"
                    : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground",
                )}
              >
                <Icon
                  aria-hidden="true"
                  className={cn("size-4.5", active && "text-primary")}
                />
                {t(key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Pages du dashboard sur téléphone : des pastilles qui défilent. */
export function AdminNav() {
  const t = useTranslations("Admin.nav");
  const current = useCurrentPage();

  return (
    <SectionTabs
      label={t("label")}
      current={current}
      tabs={PAGES.map(({ key, href }) => ({ key, href, label: t(key) }))}
    />
  );
}
