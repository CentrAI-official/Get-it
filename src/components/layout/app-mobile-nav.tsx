"use client";

import { useTranslations } from "next-intl";
import { Suspense } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { appNavItems, isActiveItem } from "./nav-items";

/** Barre de navigation flottante en bas de l'écran sur mobile, « Mes services » au centre. */
export function AppMobileNav() {
  const t = useTranslations("App.nav");

  return (
    <nav
      aria-label={t("label")}
      className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-40 rounded-3xl border border-white/10 bg-[#121216]/85 shadow-2xl shadow-black/40 backdrop-blur-xl lg:hidden"
    >
      {/* Onglets prérendus, puis onglet actif dès que l'adresse est connue */}
      <Suspense fallback={<Tabs pathname={null} />}>
        <CurrentTabs />
      </Suspense>
    </nav>
  );
}

function CurrentTabs() {
  return <Tabs pathname={usePathname()} />;
}

function Tabs({ pathname }: { pathname: string | null }) {
  const t = useTranslations("App.nav");

  return (
    <ul className="grid grid-cols-5 items-center">
      {appNavItems.map((item) => {
        const { key, href, icon: Icon } = item;
        const active = pathname !== null && isActiveItem(pathname, item);
        // « Mes services » au centre : une bulle surélevée, comme une orbite
        const center = key === "services";
        return (
          <li key={key}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-[68px] flex-col items-center justify-center gap-1 text-[0.64rem] font-medium tracking-tight whitespace-nowrap text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:text-foreground",
                active && "text-primary hover:text-primary",
              )}
            >
              {center ? (
                <span
                  className={cn(
                    "-mt-7 flex size-13 items-center justify-center rounded-2xl border transition-colors",
                    active
                      ? "border-primary bg-primary text-primary-foreground glow-primary"
                      : "border-white/15 bg-[#1b1b21] text-foreground",
                  )}
                >
                  <Icon aria-hidden="true" className="size-6" />
                </span>
              ) : (
                <Icon aria-hidden="true" className="size-[22px]" />
              )}
              {t(key)}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
