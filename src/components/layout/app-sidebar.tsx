"use client";

import { useTranslations } from "next-intl";
import { Suspense } from "react";
import { Logo } from "@/components/brand/logo";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { appNavItems, isActiveItem, type AppNavItem } from "./nav-items";

/** Barre latérale de l'application (ordinateur et tablette en paysage) : les cinq catégories. */
export function AppSidebar() {
  const t = useTranslations("App.nav");
  const tCommon = useTranslations("Common");

  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-white/5 bg-sidebar/60 px-3 py-6 backdrop-blur-xl lg:flex">
      <Link href="/community" aria-label={tCommon("homeLink")} className="px-3">
        <Logo />
      </Link>
      <nav aria-label={t("label")} className="mt-8 flex flex-1 flex-col gap-1">
        <SidebarLinks items={appNavItems} />
      </nav>
    </aside>
  );
}

type SidebarLinksProps = { items: readonly AppNavItem[] };

/**
 * Liens prérendus sans mise en évidence, puis lien actif dès que l'adresse est connue
 * (sur /goals/[id], elle ne l'est qu'à la requête : usePathname suspend).
 */
function SidebarLinks({ items }: SidebarLinksProps) {
  return (
    <Suspense fallback={<LinkList items={items} pathname={null} />}>
      <CurrentLinks items={items} />
    </Suspense>
  );
}

function CurrentLinks({ items }: SidebarLinksProps) {
  return <LinkList items={items} pathname={usePathname()} />;
}

function LinkList({
  items,
  pathname,
}: SidebarLinksProps & { pathname: string | null }) {
  const t = useTranslations("App.nav");

  return items.map((item) => {
    const { key, href, icon: Icon } = item;
    const active = pathname !== null && isActiveItem(pathname, item);
    return (
      <Link
        key={key}
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground",
          active &&
            "bg-primary/10 text-foreground before:absolute before:inset-y-2.5 before:left-0 before:w-0.5 before:rounded-full before:bg-primary hover:bg-primary/10",
        )}
      >
        <Icon
          aria-hidden="true"
          className={cn("size-4", active && "text-primary")}
        />
        {t(key)}
      </Link>
    );
  });
}
