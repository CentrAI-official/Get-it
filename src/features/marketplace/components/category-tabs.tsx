"use client";

import {
  Activity,
  Apple,
  BookOpen,
  Brain,
  Dumbbell,
  Handshake,
  Shirt,
  ShoppingBag,
  Sparkles,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  all: Sparkles,
  services: Handshake,
  gear: ShoppingBag,
  fitness_coach: Activity,
  nutritionist: Apple,
  financial_advisor: Wallet,
  psychologist: Brain,
  clothing: Shirt,
  equipment: Dumbbell,
  books: BookOpen,
};

export type CategoryTab = {
  key: string;
  href: string;
  label: string;
  active: boolean;
};

/**
 * Rangée de catégories en icônes. Changer de catégorie ne fait pas glisser la
 * page (décision du fondateur, 2026-11-08) : seul le trait orange se déplace
 * sous la catégorie touchée, tout de suite, avant même que la liste arrive.
 */
export function CategoryTabs({
  items,
  label,
}: {
  items: CategoryTab[];
  label: string;
}) {
  const nav = useRef<HTMLElement>(null);
  const bar = useRef<HTMLSpanElement>(null);
  const settled = items.find((item) => item.active)?.key ?? null;
  // Catégorie touchée, en attendant la page : le trait y va aussitôt ; une
  // fois la page arrivée (autre catégorie active), elle fait foi
  const [chosen, setChosen] = useState<{
    key: string;
    from: string | null;
  } | null>(null);
  const active = chosen && chosen.from === settled ? chosen.key : settled;

  useLayoutEffect(() => {
    const element = nav.current?.querySelector<HTMLElement>(
      `[data-key="${active ?? ""}"]`,
    );
    const line = bar.current;
    if (!line) return;
    if (!element) {
      line.style.opacity = "0";
      return;
    }
    const left = element.offsetLeft;
    const width = element.offsetWidth;
    line.style.opacity = "1";
    line.style.left = `${left}px`;
    line.style.width = `${width}px`;
    // La catégorie reste visible dans la rangée (sans faire défiler la page)
    const row = nav.current;
    if (!row) return;
    if (left < row.scrollLeft) row.scrollTo({ left: left - 16 });
    else if (left + width > row.scrollLeft + row.clientWidth) {
      row.scrollTo({ left: left + width - row.clientWidth + 16 });
    }
  }, [active]);

  return (
    <nav
      ref={nav}
      aria-label={label}
      className="relative -mx-4 flex [scrollbar-width:none] gap-6 overflow-x-auto border-b border-foreground/8 px-4 sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
    >
      {items.map((item) => {
        const Icon = CATEGORY_ICONS[item.key] ?? Sparkles;
        const on = item.key === active;
        return (
          <Link
            key={item.key}
            data-key={item.key}
            href={item.href}
            // Pas d'animation de page : la liste change sur place
            transitionTypes={[]}
            scroll={false}
            aria-current={item.active ? "page" : undefined}
            onClick={() => setChosen({ key: item.key, from: settled })}
            className={cn(
              "flex shrink-0 flex-col items-center gap-1.5 rounded-sm pt-1 pb-2.5 text-xs font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              on
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon aria-hidden="true" className="size-6" />
            {item.label}
          </Link>
        );
      })}
      <span
        ref={bar}
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-0 h-0.5 w-0 rounded-full bg-primary opacity-0 transition-[left,width] duration-300 ease-out motion-reduce:transition-none"
      />
    </nav>
  );
}
