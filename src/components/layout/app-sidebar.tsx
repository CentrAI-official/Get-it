"use client";

import { useTranslations } from "next-intl";
import { Logo } from "@/components/brand/logo";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { SignOutButton } from "@/features/auth/components/sign-out-button";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import {
  appNavItems,
  isActivePath,
  settingsNavItem,
  type AppNavItem,
} from "./nav-items";

/** Barre latérale de l'application (ordinateur et tablette en paysage). */
export function AppSidebar() {
  const t = useTranslations("App.nav");
  const tCommon = useTranslations("Common");
  const pathname = usePathname();

  function renderItem({ key, href, icon: Icon }: AppNavItem) {
    const active = isActivePath(pathname, href);
    return (
      <Link
        key={key}
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          active &&
            "bg-sidebar-accent text-sidebar-accent-foreground before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-primary",
        )}
      >
        <Icon
          aria-hidden="true"
          className={cn("size-4", active && "text-primary")}
        />
        {t(key)}
      </Link>
    );
  }

  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-3 py-6 lg:flex">
      <Link href="/today" aria-label={tCommon("homeLink")} className="px-3">
        <Logo />
      </Link>
      <nav aria-label={t("label")} className="mt-10 flex flex-1 flex-col gap-1">
        {appNavItems.map(renderItem)}
      </nav>
      <div className="flex flex-col gap-2 border-t border-sidebar-border pt-4">
        {renderItem(settingsNavItem)}
        <SignOutButton
          variant="ghost"
          className="h-auto w-full justify-start gap-3 px-3 py-2 font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        />
        <div className="px-1">
          <LocaleSwitcher align="start" />
        </div>
      </div>
    </aside>
  );
}
