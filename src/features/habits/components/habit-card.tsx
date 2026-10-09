"use client";

import { Check, Flame, Pencil } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { pillarIcons } from "@/config/pillars";
import { Link } from "@/i18n/navigation";
import { isoWeekday, lastDays, toDbDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { HabitSummary } from "@/server/habits/service";
import { EDITABLE_DAYS } from "../schemas";
import { useHabitCompletions } from "../use-habit-completions";
import { ScheduleLabel } from "./schedule-label";

type HabitCardProps = {
  habit: HabitSummary;
  /** Aujourd'hui, dans le fuseau de l'utilisateur. */
  today: string;
};

/** Habitude en cours : série, record et les 7 derniers jours à cocher. */
export function HabitCard({ habit, today }: HabitCardProps) {
  const t = useTranslations("Habits");
  const tPillars = useTranslations("Pillars");
  const format = useFormatter();
  const Icon = pillarIcons[habit.pillar];

  // La case réagit tout de suite ; le serveur confirme ensuite
  const { completions, toggle, current, best } = useHabitCompletions(
    habit,
    today,
  );

  return (
    <article className="flex flex-col gap-4 rounded-xl border bg-card p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-silver">
          <Icon aria-hidden="true" className="size-5" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3 className="font-medium break-words">{habit.title}</h3>
          <p className="text-sm text-muted-foreground">
            {tPillars(`${habit.pillar}.name`)} ·{" "}
            <ScheduleLabel weekdays={habit.weekdays} />
          </p>
          {habit.goal ? (
            <Link
              href={`/goals/${habit.goal.id}`}
              className="w-fit text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              {t("linkedGoal", { goal: habit.goal.title })}
            </Link>
          ) : null}
        </div>
        <Button asChild variant="ghost" size="icon-sm">
          <Link href={`/habits/${habit.id}/edit`} aria-label={t("edit")}>
            <Pencil aria-hidden="true" />
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <Flame
            aria-hidden="true"
            className={cn(
              "size-4",
              current > 0 ? "text-primary" : "text-muted-foreground",
            )}
          />
          {t("streak", { count: current })}
        </p>
        {best > 0 ? (
          <p className="text-xs text-muted-foreground">
            {t("best", { count: best })}
          </p>
        ) : null}
      </div>

      <ol aria-label={t("weekLabel")} className="grid grid-cols-7 gap-1">
        {lastDays(today, EDITABLE_DAYS).map((day) => {
          const date = toDbDate(day);
          const done = completions.has(day);
          const scheduled = habit.weekdays.includes(isoWeekday(day));
          const isToday = day === today;
          return (
            <li key={day}>
              <button
                type="button"
                aria-pressed={done}
                aria-label={t("dayLabel", {
                  date: format.dateTime(date, {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    timeZone: "UTC",
                  }),
                  scheduled: scheduled ? "yes" : "no",
                })}
                disabled={day < habit.startDay}
                onClick={() => toggle(day)}
                className={cn(
                  "flex w-full flex-col items-center gap-1 rounded-lg py-1.5 text-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-30",
                  isToday && "bg-secondary",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "uppercase",
                    isToday ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {format.dateTime(date, {
                    weekday: "narrow",
                    timeZone: "UTC",
                  })}
                </span>
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-8 items-center justify-center rounded-full border text-sm tabular-nums transition-colors",
                    done
                      ? "border-primary bg-primary text-primary-foreground"
                      : scheduled
                        ? "border-input text-foreground"
                        : "border-dashed border-border text-muted-foreground",
                  )}
                >
                  {done ? (
                    <Check className="size-4" />
                  ) : (
                    format.dateTime(date, { day: "numeric", timeZone: "UTC" })
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </article>
  );
}
