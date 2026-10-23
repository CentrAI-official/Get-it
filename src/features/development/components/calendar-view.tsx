"use client";

import {
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Flag,
  LoaderCircle,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useOptimistic, useState, useTransition } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { EDITABLE_DAYS } from "@/features/habits/schemas";
import { setHabitDayAction } from "@/features/habits/actions";
import { setTaskDoneAction } from "@/features/tasks/actions";
import { daysBetween, toDbDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { loadCalendarAction } from "../actions";
import {
  addMonths,
  dayEntries,
  markedDays,
  monthGrid,
  monthOf,
  type CalendarData,
} from "../calendar";
import type { DevelopmentKind } from "../questionnaires";

type CalendarViewProps = {
  /** Mois en cours, préparé par le serveur (rafraîchi après chaque coche). */
  initial: CalendarData;
  scope: DevelopmentKind | "all";
};

const asDate = (day: string) => toDbDate(day);

/**
 * Calendrier de « Mon développement » : un mois, un point les jours où une
 * séance, une tâche ou un objectif est prévu, et le détail du jour choisi.
 */
export function CalendarView({ initial, scope }: CalendarViewProps) {
  const t = useTranslations("Development.calendar");
  const tKinds = useTranslations("Development.kinds");
  const tWeekdays = useTranslations("Development.weekdaysShort");
  const format = useFormatter();
  const today = initial.today;
  const [month, setMonth] = useState(initial.month);
  const [selected, setSelected] = useState(today);
  const [cache, setCache] = useState<Record<string, CalendarData>>({});
  const [loading, setLoading] = useState(false);
  // Coches affichées tout de suite, en attendant la réponse du serveur
  const [optimistic, applyOptimistic] = useOptimistic<
    Record<string, boolean>,
    { key: string; done: boolean }
  >({}, (current, change) => ({ ...current, [change.key]: change.done }));
  const [, startTransition] = useTransition();

  const data = month === initial.month ? initial : cache[month];
  const marked = data ? markedDays(data) : new Set<string>();
  const entries =
    data && monthOf(selected) === month ? dayEntries(data, selected) : null;
  const plan = scope === "all" ? null : (initial.plans[0] ?? null);

  async function reload(target: string) {
    if (target === initial.month) return;
    const fresh = await loadCalendarAction(scope, target);
    if (fresh) setCache((current) => ({ ...current, [target]: fresh }));
  }

  async function goTo(target: string) {
    setMonth(target);
    setSelected(target === monthOf(today) ? today : `${target}-01`);
    if (target === initial.month || cache[target]) return;
    setLoading(true);
    await reload(target);
    setLoading(false);
  }

  function toggleTask(id: string, done: boolean) {
    startTransition(async () => {
      applyOptimistic({ key: `task:${id}`, done });
      await setTaskDoneAction(id, done);
      await reload(month);
    });
  }

  function toggleHabit(id: string, day: string, done: boolean) {
    startTransition(async () => {
      applyOptimistic({ key: `habit:${id}:${day}`, done });
      await setHabitDayAction(id, day, done);
      await reload(month);
    });
  }

  const monthLabel = format.dateTime(asDate(`${month}-01`), {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <div className="flex flex-col gap-4">
      {plan ? (
        <p className="text-sm text-muted-foreground">
          {t("period", {
            from: format.dateTime(asDate(plan.startsOn), {
              day: "numeric",
              month: "long",
              timeZone: "UTC",
            }),
            to: format.dateTime(asDate(plan.endsOn), {
              day: "numeric",
              month: "long",
              year: "numeric",
              timeZone: "UTC",
            }),
          })}
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <h3
          className="font-heading text-lg font-bold capitalize"
          aria-live="polite"
        >
          {monthLabel}
        </h3>
        <div className="flex items-center gap-1">
          {loading ? (
            <LoaderCircle
              aria-label={t("loading")}
              className="size-4 animate-spin text-muted-foreground"
            />
          ) : null}
          {month !== monthOf(today) ? (
            <button
              type="button"
              onClick={() => void goTo(monthOf(today))}
              className="h-9 rounded-full px-3 text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {t("today")}
            </button>
          ) : null}
          {[
            [-1, t("previous"), ChevronLeft],
            [1, t("next"), ChevronRight],
          ].map(([delta, label, Icon]) => {
            const Arrow = Icon as typeof ChevronLeft;
            return (
              <button
                key={String(delta)}
                type="button"
                aria-label={label as string}
                onClick={() => void goTo(addMonths(month, delta as number))}
                className="flex size-9 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-white/5 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <Arrow aria-hidden="true" className="size-5" />
              </button>
            );
          })}
        </div>
      </div>

      <div role="grid" aria-label={monthLabel} className="flex flex-col gap-1">
        <div role="row" className="grid grid-cols-7">
          {[1, 2, 3, 4, 5, 6, 7].map((weekday) => (
            <span
              key={weekday}
              role="columnheader"
              className="text-center text-xs text-muted-foreground"
            >
              {tWeekdays(String(weekday) as "1")}
            </span>
          ))}
        </div>
        {monthGrid(month).map((week, index) => (
          <div key={index} role="row" className="grid grid-cols-7 gap-1">
            {week.map((day, column) =>
              day ? (
                <button
                  key={day}
                  type="button"
                  role="gridcell"
                  data-day={day}
                  data-marked={marked.has(day) ? "" : undefined}
                  aria-selected={day === selected}
                  aria-label={format.dateTime(asDate(day), {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    timeZone: "UTC",
                  })}
                  onClick={() => setSelected(day)}
                  className={cn(
                    "relative flex h-11 flex-col items-center justify-center rounded-xl font-mono text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    day === selected
                      ? "bg-primary font-bold text-primary-foreground"
                      : "hover:bg-white/5",
                    day === today &&
                      day !== selected &&
                      "ring-1 ring-primary/60",
                  )}
                >
                  {Number(day.slice(8))}
                  {marked.has(day) ? (
                    <span
                      aria-hidden="true"
                      className={cn(
                        "absolute bottom-1.5 size-1 rounded-full",
                        day === selected
                          ? "bg-primary-foreground"
                          : "bg-foreground/70",
                      )}
                    />
                  ) : null}
                </button>
              ) : (
                <span
                  key={`empty-${column}`}
                  role="gridcell"
                  aria-hidden="true"
                />
              ),
            )}
          </div>
        ))}
      </div>

      {/* Le jour choisi */}
      <section
        aria-live="polite"
        className="flex flex-col gap-4 border-t border-white/8 pt-4"
      >
        <h4 className="font-semibold capitalize">
          {format.dateTime(asDate(selected), {
            weekday: "long",
            day: "numeric",
            month: "long",
            timeZone: "UTC",
          })}
        </h4>
        {!entries ? (
          <p className="text-sm text-muted-foreground">{t("loading")}</p>
        ) : entries.sessions.length +
            entries.goals.length +
            entries.tasks.length +
            entries.habits.length ===
          0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <>
            {entries.sessions.map(({ plan: source, session }) => (
              <div key={source.id} className="flex flex-col gap-2">
                <p className="flex flex-wrap items-baseline gap-x-2">
                  <Dumbbell
                    aria-hidden="true"
                    className="size-4 translate-y-0.5 text-primary"
                  />
                  <span className="font-semibold">{session.title}</span>
                  {scope === "all" ? (
                    <span className="text-xs text-muted-foreground">
                      {tKinds(`${source.kind}.title`)}
                    </span>
                  ) : null}
                </p>
                <ul className="flex flex-col gap-1.5 pl-6">
                  {session.items.map((entry, index) => (
                    <li key={`${entry.name}-${index}`} className="text-sm">
                      <span className="font-medium">{entry.name}</span>
                      {entry.detail ? (
                        <span className="text-muted-foreground">
                          {" "}
                          — {entry.detail}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            {entries.goals.map((goal) => (
              <p key={goal.id} className="flex items-start gap-2 text-sm">
                <Flag
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 text-primary"
                />
                <span>
                  <span className="font-medium">{goal.title}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {t(goal.done ? "goalDone" : "goalDue")}
                  </span>
                </span>
              </p>
            ))}

            {entries.tasks.length > 0 ? (
              <div className="flex flex-col gap-1">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {t("tasks")}
                </p>
                <ul className="flex flex-col divide-y divide-white/8">
                  {entries.tasks.map((task) => {
                    const done = optimistic[`task:${task.id}`] ?? task.done;
                    return (
                      <li key={task.id}>
                        <label className="flex items-center gap-3 py-2.5 text-sm">
                          <Checkbox
                            checked={done}
                            onCheckedChange={(value) =>
                              toggleTask(task.id, value === true)
                            }
                          />
                          <span
                            className={cn(
                              done && "text-muted-foreground line-through",
                            )}
                          >
                            {task.title}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

            {entries.habits.length > 0 ? (
              <div className="flex flex-col gap-1">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {t("habits")}
                </p>
                <ul className="flex flex-col divide-y divide-white/8">
                  {entries.habits.map(({ habit, done: saved }) => {
                    const key = `habit:${habit.id}:${selected}`;
                    const done = optimistic[key] ?? saved;
                    const age = daysBetween(selected, today);
                    const editable = age >= 0 && age < EDITABLE_DAYS;
                    return (
                      <li key={habit.id}>
                        <label className="flex items-center gap-3 py-2.5 text-sm">
                          <Checkbox
                            checked={done}
                            disabled={!editable}
                            onCheckedChange={(value) =>
                              toggleHabit(habit.id, selected, value === true)
                            }
                          />
                          <span className="flex flex-col">
                            <span
                              className={cn(
                                done && "text-muted-foreground line-through",
                              )}
                            >
                              {habit.title}
                            </span>
                            {editable ? null : (
                              <span className="text-xs text-muted-foreground">
                                {t(age < 0 ? "future" : "tooOld")}
                              </span>
                            )}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
