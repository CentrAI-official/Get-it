"use client";

import { Check, Flame } from "lucide-react";
import { useTranslations } from "next-intl";
import { pillarIcons } from "@/config/pillars";
import { useHabitCompletions } from "@/features/habits/use-habit-completions";
import { cn } from "@/lib/utils";
import type { HabitSummary } from "@/server/habits/service";

type TodayHabitsProps = {
  habits: HabitSummary[];
  /** Aujourd'hui, dans le fuseau de l'utilisateur. */
  today: string;
};

/** Habitudes prévues aujourd'hui, à cocher en un geste. */
export function TodayHabits({ habits, today }: TodayHabitsProps) {
  return (
    <ul className="flex flex-col gap-2">
      {habits.map((habit) => (
        <TodayHabit key={habit.id} habit={habit} today={today} />
      ))}
    </ul>
  );
}

function TodayHabit({ habit, today }: { habit: HabitSummary; today: string }) {
  const t = useTranslations("Habits");
  const tPillars = useTranslations("Pillars");
  const { completions, toggle, current } = useHabitCompletions(habit, today);
  const done = completions.has(today);
  const Icon = pillarIcons[habit.pillar];

  return (
    <li className="flex items-center gap-3 rounded-lg border bg-card/60 py-2 pr-3 pl-2">
      <button
        type="button"
        aria-pressed={done}
        aria-label={habit.title}
        onClick={() => toggle(today)}
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full border transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          done
            ? "border-primary bg-primary text-primary-foreground"
            : "border-input hover:border-primary/60",
        )}
      >
        {done ? <Check aria-hidden="true" className="size-4" /> : null}
      </button>
      <div className="flex min-w-0 flex-1 flex-col">
        <span
          className={cn(
            "text-sm break-words",
            done && "text-muted-foreground line-through",
          )}
        >
          {habit.title}
        </span>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Icon aria-hidden="true" className="size-3 text-silver" />
          {tPillars(`${habit.pillar}.name`)}
        </span>
      </div>
      <span
        className={cn(
          "flex shrink-0 items-center gap-1 text-xs tabular-nums",
          current > 0 ? "text-foreground" : "text-muted-foreground",
        )}
        title={t("streak", { count: current })}
      >
        <Flame
          aria-hidden="true"
          className={cn("size-3.5", current > 0 && "text-primary")}
        />
        <span className="sr-only">{t("streak", { count: current })}</span>
        <span aria-hidden="true">{current}</span>
      </span>
    </li>
  );
}
