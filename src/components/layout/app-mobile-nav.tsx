"use client";

import { useTranslations } from "next-intl";
import { Suspense } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { isActiveItem, mobileNavItems } from "./nav-items";
import { QuickAdd } from "./quick-add";

/** Barre de navigation flottante en bas de l'écran sur mobile, avec le « + » au centre. */
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
  const half = Math.ceil(mobileNavItems.length / 2);

  function renderTab(item: (typeof mobileNavItems)[number]) {
    const { key, href, icon: Icon } = item;
    const active = pathname !== null && isActiveItem(pathname, item);
    return (
      <li key={key}>
        <Link
          href={href}
          aria-current={active ? "page" : undefined}
          className={cn(
            "flex h-[68px] flex-col items-center justify-center gap-1 text-[0.68rem] font-medium text-muted-foreground transition-colors hover:text-foreground",
            active && "text-primary hover:text-primary",
          )}
        >
          <Icon aria-hidden="true" className="size-[22px]" />
          {t(key)}
        </Link>
      </li>
    );
  }

  return (
    <ul className="grid grid-cols-5 items-center">
      {mobileNavItems.slice(0, half).map(renderTab)}
      <li>
        <QuickAdd variant="fab" />
      </li>
      {mobileNavItems.slice(half).map(renderTab)}
    </ul>
  );
}
