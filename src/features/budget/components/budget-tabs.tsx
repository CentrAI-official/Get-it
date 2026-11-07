"use client";

import { useLayoutEffect, useRef } from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const TABS = {
  month: "/services/financial/budget",
  transactions: "/services/financial/budget/transactions",
  bills: "/services/financial/budget/bills",
  accounts: "/services/financial/budget/accounts",
  goals: "/services/financial/budget/goals",
  reports: "/services/financial/budget/reports",
} as const;

export type BudgetTabKey = keyof typeof TABS;

// Chaque onglet est une page : la position de défilement est gardée de l'une à l'autre
const scroll = { left: 0 };

/**
 * Les onglets du budget. Un trait sous l'onglet ouvert : ils se lisent comme un
 * niveau en dessous des pastilles de la section.
 */
export function BudgetTabs({
  current,
  label,
  labels,
}: {
  current: BudgetTabKey;
  label: string;
  labels: Record<BudgetTabKey, string>;
}) {
  const ref = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const nav = ref.current;
    if (!nav) return;
    nav.scrollLeft = scroll.left;
    const active = nav.querySelector<HTMLElement>('[aria-current="page"]');
    if (!active) return;
    const box = nav.getBoundingClientRect();
    const tab = active.getBoundingClientRect();
    if (tab.left < box.left) nav.scrollLeft -= box.left - tab.left + 16;
    else if (tab.right > box.right)
      nav.scrollLeft += tab.right - box.right + 16;
    scroll.left = nav.scrollLeft;
  }, [current]);

  return (
    <nav
      ref={ref}
      aria-label={label}
      onScroll={(event) => {
        scroll.left = event.currentTarget.scrollLeft;
      }}
      className="-mx-4 [scrollbar-width:none] overflow-x-auto border-b border-foreground/8 px-4 sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
    >
      <ul className="flex w-max gap-5">
        {(Object.keys(TABS) as BudgetTabKey[]).map((key) => (
          <li key={key}>
            <Link
              href={TABS[key]}
              transitionTypes={["nav-tab"]}
              aria-current={key === current ? "page" : undefined}
              className={cn(
                "-mb-px flex h-11 items-center border-b-2 text-sm font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                key === current
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {labels[key]}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
