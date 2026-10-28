"use client";

import { Check, Flame, Pencil } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { pillarIcons } from "@/config/pillars";
import { KIND_COLORS } from "@/features/development/colors";
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

/** Habitude en cours : série, record et les 7 derniers jours à cocher ; la couleur dit le pilier. */
export function HabitCard({ habit, today }: HabitCardProps) {
  const t = useTranslations("Habits");
  const tPillars = useTranslations("Pillars");
  const format = useFormatter();
  const Icon = pillarIcons[habit.pillar];
  const colors = KIND_COLORS[habit.pillar];

  // La case réagit tout de suite ; le serveur confirme ensuite
  const { completions, toggle, current, best } = useHabitCompletions(
    habit,
    today,
  );

  return (
    <article className="flex flex-col gap-4 border-b border-foreground/8 py-5">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-full",
            colors.tint,
            colors.text,
          )}
        >
          <Icon aria-hidden="true" className="size-5" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3 className="font-semibold break-words">{habit.title}</h3>
          <p className="text-sm text-muted-foreground">
            <span className={colors.text}>
              {tPillars(`${habit.pillar}.name`)}
            </span>{" "}
            · <ScheduleLabel weekdays={habit.weekdays} />
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

      <div className="flex flex-wrap items-end justify-between gap-2">
        <p className="flex items-center gap-2.5">
          <Flame
            aria-hidden="true"
            className={cn(
              "size-7",
              current > 0 ? "text-primary" : "text-muted-foreground",
            )}
          />
          <span className="flex flex-col gap-0.5">
            <span
              aria-hidden="true"
              className="font-display text-2xl leading-none"
            >
              {t("streakValue", { count: current })}
            </span>
            <span aria-hidden="true" className="text-xs text-muted-foreground">
              {t("streakCaption")}
            </span>
            <span className="sr-only">{t("streak", { count: current })}</span>
          </span>
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
                  "flex w-full flex-col items-center gap-1.5 rounded-xl py-1.5 text-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-30",
                  isToday && "bg-foreground/[0.06]",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "font-semibold uppercase",
                    isToday
                      ? "font-bold text-foreground"
                      : "text-muted-foreground",
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
                    "flex size-9 items-center justify-center rounded-full text-sm tabular-nums transition-all duration-200",
                    done
                      ? "bg-primary text-primary-foreground glow-primary"
                      : scheduled
                        ? "border-2 border-foreground/15 text-foreground"
                        : "border border-dashed border-foreground/10 text-muted-foreground",
                  )}
                >
                  {done ? (
                    <Check className="size-4" strokeWidth={3} />
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
