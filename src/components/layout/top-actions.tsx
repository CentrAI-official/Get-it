"use client";

import { useTranslations } from "next-intl";
import { Suspense } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import {
  categoryActions,
  currentCategory,
  isActivePath,
  topActions,
} from "./nav-items";

/**
 * Boutons du haut à droite, propres à la catégorie de la page. Rien n'est
 * affiché tant que l'adresse n'est pas connue (routes à paramètre).
 */
export function TopActions() {
  return (
    <Suspense fallback={null}>
      <CurrentActions />
    </Suspense>
  );
}

function CurrentActions() {
  const t = useTranslations("App.topActions");
  const pathname = usePathname();
  const category = currentCategory(pathname);
  if (!category) return null;

  return (
    <ul aria-label={t("label")} className="flex items-center gap-1">
      {categoryActions[category].map((key) => {
        const { href, icon: Icon } = topActions[key];
        const active = isActivePath(pathname, href);
        return (
          <li key={key}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex size-10 items-center justify-center gap-2 rounded-full text-sm font-medium text-muted-foreground transition-colors outline-none hover:bg-white/5 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 lg:size-auto lg:px-3 lg:py-2",
                active && "text-primary hover:text-primary",
              )}
            >
              <Icon aria-hidden="true" className="size-5 lg:size-4" />
              <span className="sr-only lg:not-sr-only">{t(key)}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
