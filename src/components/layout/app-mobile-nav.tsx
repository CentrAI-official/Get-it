"use client";

import { useTranslations } from "next-intl";
import { Suspense } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { isActivePath, mobileNavItems } from "./nav-items";

/** Barre de navigation fixée en bas de l'écran sur mobile. */
export function AppMobileNav() {
  const t = useTranslations("App.nav");

  return (
    <nav
      aria-label={t("label")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
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
    <ul className="mx-auto grid max-w-md grid-cols-5">
      {mobileNavItems.map(({ key, href, icon: Icon }) => {
        const active = pathname !== null && isActivePath(pathname, href);
        return (
          <li key={key}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-col items-center gap-1 py-2.5 text-[0.7rem] font-medium text-muted-foreground transition-colors hover:text-foreground",
                active && "text-primary hover:text-primary",
              )}
            >
              <Icon aria-hidden="true" className="size-5" />
              {t(key)}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
