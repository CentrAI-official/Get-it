"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { PILLARS } from "@/config/pillars";
import { KIND_COLORS } from "@/features/development/colors";
import { cn } from "@/lib/utils";
import type { HabitSummary } from "@/server/habits/service";
import {
  arrangeHabits,
  countByPillar,
  HABIT_SORTS,
  type HabitPillarFilter,
} from "../filters";
import { HabitCard } from "./habit-card";

type HabitListProps = {
  habits: HabitSummary[];
  /** Aujourd'hui, dans le fuseau de l'utilisateur. */
  today: string;
};

const select =
  "h-9 min-w-0 rounded-full border border-foreground/12 bg-foreground/[0.03] px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&>option]:bg-popover";

/** Habitudes en cours, filtrées par pilier et triées par date de création. */
export function HabitList({ habits, today }: HabitListProps) {
  const t = useTranslations("Habits.filters");
  const tPillars = useTranslations("Pillars");
  const id = useId();
  const [pillar, setPillar] = useState<HabitPillarFilter>("all");
  const [sort, setSort] = useState<(typeof HABIT_SORTS)[number]>("oldest");

  const counts = countByPillar(habits);
  const pillars = PILLARS.filter((item) => counts.has(item));
  // Un pilier vidé (habitude mise en pause) : retour à « Toutes »
  const current = pillar !== "all" && !counts.has(pillar) ? "all" : pillar;
  const shown = arrangeHabits(habits, current, sort);

  return (
    <div className="flex flex-col gap-2">
      {habits.length > 1 ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {pillars.length > 1 ? (
            <div
              role="radiogroup"
              aria-label={t("pillarLabel")}
              className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
            >
              {(["all", ...pillars] as const).map((value) => {
                const checked = current === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={checked}
                    onClick={() => setPillar(value)}
                    className={cn(
                      "flex h-9 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      checked
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-foreground/12 bg-foreground/[0.03] text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {value !== "all" ? (
                      <span
                        aria-hidden="true"
                        className={cn(
                          "size-2 rounded-full",
                          KIND_COLORS[value].dot,
                        )}
                      />
                    ) : null}
                    {value === "all" ? t("all") : tPillars(`${value}.name`)}
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {value === "all" ? habits.length : counts.get(value)}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <label
              htmlFor={`${id}-sort`}
              className="text-sm text-muted-foreground"
            >
              {t("sortLabel")}
            </label>
            <select
              id={`${id}-sort`}
              value={sort}
              onChange={(event) =>
                setSort(
                  HABIT_SORTS.find((item) => item === event.target.value) ??
                    "oldest",
                )
              }
              className={select}
            >
              {HABIT_SORTS.map((value) => (
                <option key={value} value={value}>
                  {t(value)}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}

      <ul className="grid md:grid-cols-2 md:gap-x-8">
        {shown.map((habit) => (
          <li key={habit.id}>
            <HabitCard habit={habit} today={today} />
          </li>
        ))}
      </ul>
    </div>
  );
}
