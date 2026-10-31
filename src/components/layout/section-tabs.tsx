"use client";

import { useLayoutEffect, useRef } from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export type SectionTab = { key: string; href: `/${string}`; label: string };

type SectionTabsProps = {
  /** Nom accessible de la navigation (ex. « Sections du profil »). */
  label: string;
  tabs: readonly SectionTab[];
  current: string;
};

// Chaque onglet est une page : la position de défilement est gardée d'une page à l'autre
const scrollPositions = new Map<string, number>();

/** Sous-onglets d'une catégorie (Profil, Marketplace), en pastilles défilantes. */
export function SectionTabs({ label, tabs, current }: SectionTabsProps) {
  const ref = useRef<HTMLElement>(null);

  // Avant l'affichage : même position qu'à la page précédente, onglet choisi visible
  useLayoutEffect(() => {
    const nav = ref.current;
    if (!nav) return;
    nav.scrollLeft = scrollPositions.get(label) ?? 0;
    const active = nav.querySelector<HTMLElement>('[aria-current="page"]');
    if (!active) return;
    const box = nav.getBoundingClientRect();
    const tab = active.getBoundingClientRect();
    if (tab.left < box.left) nav.scrollLeft -= box.left - tab.left + 16;
    else if (tab.right > box.right)
      nav.scrollLeft += tab.right - box.right + 16;
    scrollPositions.set(label, nav.scrollLeft);
  }, [label, current]);

  return (
    <nav
      ref={ref}
      aria-label={label}
      onScroll={(event) =>
        scrollPositions.set(label, event.currentTarget.scrollLeft)
      }
      className="-mx-1 [scrollbar-width:none] overflow-x-auto px-1 [&::-webkit-scrollbar]:hidden"
    >
      <ul className="flex w-max gap-2">
        {tabs.map(({ key, href, label: tabLabel }) => (
          <li key={key}>
            <Link
              href={href}
              transitionTypes={["nav-tab"]}
              aria-current={key === current ? "page" : undefined}
              className={cn(
                "flex rounded-full border px-4 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                key === current
                  ? "border-primary bg-primary/15 text-foreground"
                  : "border-foreground/10 bg-foreground/[0.03] text-muted-foreground hover:text-foreground",
              )}
            >
              {tabLabel}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
