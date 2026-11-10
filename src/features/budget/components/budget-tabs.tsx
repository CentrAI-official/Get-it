"use client";

import { useLayoutEffect, useRef } from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import {
  BUDGET_TAB_KEYS,
  BUDGET_TABS,
  neighborTab,
  tabMemory,
  tabSwipe,
  type BudgetTabKey,
} from "./tab-swipe";

export type { BudgetTabKey } from "./tab-swipe";

const SLIDE = "280ms cubic-bezier(0.2, 0.7, 0.2, 1)";

/**
 * Les onglets du budget. Un trait orange sous l'onglet ouvert : il glisse jusqu'à
 * l'onglet touché, et suit le doigt quand on glisse la page vers le suivant
 * (décision du fondateur, 2026-11-10). La page ne glisse pas au toucher : seul le
 * trait se déplace, comme dans la Marketplace.
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
  const bar = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const nav = ref.current;
    const line = bar.current;
    if (!nav || !line) return;
    // La rangée garde sa position d'un onglet à l'autre, l'onglet ouvert reste visible
    nav.scrollLeft = tabMemory.scrollLeft;
    const active = nav.querySelector<HTMLElement>('[aria-current="page"]');
    if (active) {
      const box = nav.getBoundingClientRect();
      const tab = active.getBoundingClientRect();
      if (tab.left < box.left) nav.scrollLeft -= box.left - tab.left + 16;
      else if (tab.right > box.right) {
        nav.scrollLeft += tab.right - box.right + 16;
      }
      tabMemory.scrollLeft = nav.scrollLeft;
    }

    const rectOf = (key: BudgetTabKey | null) => {
      const element = key
        ? nav.querySelector<HTMLElement>(`[data-tab="${key}"]`)
        : null;
      return element
        ? { left: element.offsetLeft, width: element.offsetWidth }
        : null;
    };
    const target = rectOf(current);
    if (!target) return;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const place = (rect: { left: number; width: number }, animate: boolean) => {
      line.style.transition =
        animate && !reduce ? `left ${SLIDE}, width ${SLIDE}` : "none";
      line.style.left = `${rect.left}px`;
      line.style.width = `${rect.width}px`;
    };

    // Le trait part de l'onglet d'avant et glisse jusqu'à celui-ci
    const from = tabMemory.bar;
    if (from && (from.left !== target.left || from.width !== target.width)) {
      place(from, false);
      line.getBoundingClientRect();
      place(target, true);
    } else {
      place(target, false);
    }
    line.style.opacity = "1";
    tabMemory.bar = target;

    // Pendant un glissement, il suit le doigt vers l'onglet voisin
    return tabSwipe.subscribe((progress, animate) => {
      const next = rectOf(
        progress === 0 ? null : neighborTab(current, progress > 0 ? 1 : -1),
      );
      const amount = Math.min(Math.abs(progress), 1);
      const rect = next
        ? {
            left: target.left + (next.left - target.left) * amount,
            width: target.width + (next.width - target.width) * amount,
          }
        : target;
      place(rect, animate);
      tabMemory.bar = rect;
    });
  }, [current]);

  return (
    <nav
      ref={ref}
      aria-label={label}
      onScroll={(event) => {
        tabMemory.scrollLeft = event.currentTarget.scrollLeft;
      }}
      className="-mx-4 [scrollbar-width:none] overflow-x-auto border-b border-foreground/8 px-4 sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
    >
      <ul className="relative flex w-max gap-5">
        {BUDGET_TAB_KEYS.map((key) => (
          <li key={key}>
            <Link
              href={BUDGET_TABS[key]}
              data-tab={key}
              // Pas d'animation de page : seul le trait glisse
              transitionTypes={[]}
              aria-current={key === current ? "page" : undefined}
              className={cn(
                "flex h-11 items-center text-sm font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                key === current
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {labels[key]}
            </Link>
          </li>
        ))}
        <span
          ref={bar}
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 left-0 h-0.5 w-0 rounded-full bg-primary opacity-0"
        />
      </ul>
    </nav>
  );
}
