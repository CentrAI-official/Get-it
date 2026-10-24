"use client";

import { ChevronLeft, ChevronRight, LoaderCircle } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useOptimistic, useState, useTransition } from "react";
import type { DayMoment } from "@/config/moments";
import { EDITABLE_DAYS } from "@/features/habits/schemas";
import { setHabitDayAction } from "@/features/habits/actions";
import { setTaskDoneAction } from "@/features/tasks/actions";
import { addDays, daysBetween, toDbDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { loadCalendarAction, setMomentAction } from "../actions";
import {
  addMonths,
  dayEntries,
  dayTimeline,
  markedDays,
  monthGrid,
  monthOf,
  weekOf,
  type CalendarData,
  type MomentChange,
  type TimelineItem,
} from "../calendar";
import type { DevelopmentKind } from "../questionnaires";
import { colorsOf } from "../colors";
import { CalendarDay, kindOfItem } from "./calendar-day";

type CalendarViewProps = {
  /** Mois en cours, préparé par le serveur (rafraîchi après chaque coche). */
  initial: CalendarData;
  scope: DevelopmentKind | "all";
};

type View = "week" | "month";

const asDate = (day: string) => toDbDate(day);

/**
 * Calendrier de « Mon développement ». Vue « Semaine » par défaut : la bande
 * des 7 jours, puis le jour choisi en matin, midi et soir. Vue « Mois » : la
 * grille du mois, avec un point les jours de séance, de tâche ou d'objectif.
 */
export function CalendarView({ initial, scope }: CalendarViewProps) {
  const t = useTranslations("Development.calendar");
  const format = useFormatter();
  const today = initial.today;
  const [view, setView] = useState<View>("week");
  const [selected, setSelected] = useState(today);
  const [cache, setCache] = useState<Record<string, CalendarData>>({});
  const [loading, setLoading] = useState(false);
  // Coches et moments affichés tout de suite, en attendant le serveur
  const [optimistic, applyOptimistic] = useOptimistic<
    Record<string, boolean>,
    { key: string; done: boolean }
  >({}, (current, change) => ({ ...current, [change.key]: change.done }));
  const [moments, applyMoment] = useOptimistic<
    Record<string, DayMoment | null>,
    { key: string; moment: DayMoment | null }
  >({}, (current, change) => ({ ...current, [change.key]: change.moment }));
  const [, startTransition] = useTransition();

  const month = monthOf(selected);
  const dataFor = (target: string) =>
    target === initial.month ? initial : cache[target];
  const week = weekOf(selected);
  const plan = scope === "all" ? null : (initial.plans[0] ?? null);

  async function reload(target: string) {
    if (target === initial.month) return;
    const fresh = await loadCalendarAction(scope, target);
    if (fresh) setCache((current) => ({ ...current, [target]: fresh }));
  }

  /** Charge les mois qui manquent (une semaine peut toucher deux mois). */
  async function ensure(targets: string[]) {
    const missing = [...new Set(targets)].filter(
      (target) => target !== initial.month && !cache[target],
    );
    if (missing.length === 0) return;
    setLoading(true);
    await Promise.all(missing.map(reload));
    setLoading(false);
  }

  function select(day: string) {
    setSelected(day);
    void ensure(weekOf(day).map(monthOf));
  }

  function goToMonth(target: string) {
    select(target === monthOf(today) ? today : `${target}-01`);
  }

  function changeView(next: View) {
    setView(next);
    void ensure(next === "week" ? week.map(monthOf) : [month]);
  }

  /** Le jour avec les moments choisis à l'instant, avant la réponse du serveur. */
  function groupsOf(day: string) {
    const data = dataFor(monthOf(day));
    if (!data) return null;
    const entries = dayEntries(data, day);
    const pick = <T,>(key: string, saved: T) =>
      key in moments ? (moments[key] as T) : saved;
    return dayTimeline({
      ...entries,
      sessions: entries.sessions.map((entry) => ({
        ...entry,
        session: {
          ...entry.session,
          moment: pick(`session:${entry.plan.id}`, entry.session.moment),
        },
      })),
      habits: entries.habits.map((entry) => ({
        ...entry,
        habit: {
          ...entry.habit,
          moment: pick(`habit:${entry.habit.id}`, entry.habit.moment),
        },
      })),
      tasks: entries.tasks.map((task) => ({
        ...task,
        moment: pick(`task:${task.id}`, task.moment),
      })),
    });
  }

  function stateOf(item: TimelineItem, day: string) {
    if (item.type === "task") {
      return {
        done: optimistic[`task:${item.task.id}`] ?? item.task.done,
        editable: true,
        hint: null,
      };
    }
    if (item.type === "habit") {
      const age = daysBetween(day, today);
      const editable = age >= 0 && age < EDITABLE_DAYS;
      return {
        done: optimistic[`habit:${item.habit.id}:${day}`] ?? item.done,
        editable,
        hint: editable ? null : t(age < 0 ? "future" : "tooOld"),
      };
    }
    if (item.type === "goal") {
      return { done: item.goal.done, editable: false, hint: null };
    }
    return null;
  }

  function toggle(item: TimelineItem, done: boolean, day: string) {
    startTransition(async () => {
      if (item.type === "task") {
        applyOptimistic({ key: `task:${item.task.id}`, done });
        await setTaskDoneAction(item.task.id, done);
      } else if (item.type === "habit") {
        applyOptimistic({ key: `habit:${item.habit.id}:${day}`, done });
        await setHabitDayAction(item.habit.id, day, done);
      }
      await reload(monthOf(day));
    });
  }

  function changeMoment(change: MomentChange, key: string) {
    startTransition(async () => {
      applyMoment({ key, moment: change.moment });
      await setMomentAction(change);
      // Une séance revient chaque semaine : tous les mois chargés changent
      await Promise.all(Object.keys(cache).map(reload));
    });
  }

  const longDay = (day: string) =>
    format.dateTime(asDate(day), {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    });
  const title = format.dateTime(
    asDate(view === "week" ? selected : `${month}-01`),
    {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    },
  );
  const onCurrentPeriod =
    view === "week" ? week.includes(today) : month === monthOf(today);
  const groups = groupsOf(selected);
  const counted = (groups ?? [])
    .flatMap((group) => group.items)
    .map((item) => stateOf(item, selected))
    .filter((state) => state !== null && state.editable);
  const doneCount = counted.filter((state) => state?.done).length;
  const future = selected > today;

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

      <div className="flex min-h-9 items-center justify-between gap-2">
        <h3
          className="font-heading text-lg font-bold capitalize"
          aria-live="polite"
        >
          {title}
        </h3>
        <div className="flex items-center gap-1">
          {loading ? (
            <LoaderCircle
              aria-label={t("loading")}
              className="size-4 animate-spin text-muted-foreground"
            />
          ) : null}
          {onCurrentPeriod ? null : (
            <button
              type="button"
              onClick={() => select(today)}
              className="h-9 rounded-full px-3 text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {t("today")}
            </button>
          )}
        </div>
      </div>

      <div className="-mt-2 flex items-center justify-between gap-2">
        <div
          role="radiogroup"
          aria-label={t("viewLabel")}
          className="flex gap-0.5 rounded-full bg-white/5 p-1"
        >
          {(["week", "month"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={view === value}
              onClick={() => changeView(value)}
              className={cn(
                "h-8 rounded-full px-3 text-sm font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                view === value
                  ? "bg-white/12 text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(value)}
            </button>
          ))}
        </div>
        <div className="-mr-2 flex items-center">
          {(
            [
              [
                -1,
                view === "week" ? t("previousWeek") : t("previous"),
                ChevronLeft,
              ],
              [1, view === "week" ? t("nextWeek") : t("next"), ChevronRight],
            ] as const
          ).map(([delta, label, Arrow]) => (
            <button
              key={delta}
              type="button"
              aria-label={label}
              onClick={() =>
                view === "week"
                  ? select(addDays(selected, delta * 7))
                  : goToMonth(addMonths(month, delta))
              }
              className="flex size-10 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-white/5 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Arrow aria-hidden="true" className="size-5" />
            </button>
          ))}
        </div>
      </div>

      {view === "week" ? (
        <ol aria-label={t("weekLabel")} className="grid grid-cols-7 gap-1">
          {week.map((day) => {
            const dayGroups = groupsOf(day);
            const items = (dayGroups ?? []).flatMap((group) => group.items);
            const isSelected = day === selected;
            return (
              <li key={day}>
                <button
                  type="button"
                  data-day={day}
                  aria-pressed={isSelected}
                  aria-label={`${longDay(day)}${day === today ? ` · ${t("today")}` : ""}`}
                  onClick={() => select(day)}
                  className="flex w-full flex-col items-center gap-1.5 rounded-2xl py-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span
                    className={cn(
                      "text-xs uppercase",
                      day === today ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    {format.dateTime(asDate(day), {
                      weekday: "narrow",
                      timeZone: "UTC",
                    })}
                  </span>
                  <span
                    className={cn(
                      "flex size-10 items-center justify-center rounded-full border-2 text-base font-bold transition-colors",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : day === today
                          ? "border-primary"
                          : "border-transparent",
                      !isSelected && day < today && "text-silver",
                    )}
                  >
                    {Number(day.slice(8))}
                  </span>
                  <span aria-hidden="true" className="flex h-1.5 gap-[3px]">
                    {items.slice(0, 3).map((item) => {
                      const state = stateOf(item, day);
                      const dim =
                        day > today ||
                        (state !== null && state.editable && !state.done);
                      return (
                        <span
                          key={item.key}
                          className={cn(
                            "size-1.5 rounded-full",
                            colorsOf(kindOfItem(item)).dot,
                            dim && "opacity-40",
                          )}
                        />
                      );
                    })}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      ) : (
        <MonthGrid
          month={month}
          data={dataFor(month)}
          selected={selected}
          today={today}
          onSelect={select}
        />
      )}

      {/* Le jour choisi */}
      <section
        aria-live="polite"
        className="flex flex-col gap-3 border-t border-white/8 pt-4"
      >
        <div className="flex items-baseline justify-between gap-3">
          <h4 className="font-semibold capitalize">{longDay(selected)}</h4>
          {groups && counted.length > 0 ? (
            <span className="shrink-0 text-sm text-muted-foreground">
              {future
                ? t("dayPlanned", { total: counted.length })
                : t("daySummary", { done: doneCount, total: counted.length })}
            </span>
          ) : null}
        </div>
        {!groups ? (
          <p className="text-sm text-muted-foreground">{t("loading")}</p>
        ) : groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <CalendarDay
            groups={groups}
            showPlan={scope === "all"}
            stateOf={(item) => stateOf(item, selected)}
            onToggle={(item, done) => toggle(item, done, selected)}
            onMoment={changeMoment}
          />
        )}
      </section>
    </div>
  );
}

type MonthGridProps = {
  month: string;
  data: CalendarData | undefined;
  selected: string;
  today: string;
  onSelect: (day: string) => void;
};

/** Le mois : un point les jours de séance, de tâche ou d'objectif. */
function MonthGrid({ month, data, selected, today, onSelect }: MonthGridProps) {
  const tWeekdays = useTranslations("Development.weekdaysShort");
  const format = useFormatter();
  const marked = data ? markedDays(data) : new Set<string>();
  const label = format.dateTime(asDate(`${month}-01`), {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <div role="grid" aria-label={label} className="flex flex-col gap-1">
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
                onClick={() => onSelect(day)}
                className={cn(
                  "relative flex h-11 flex-col items-center justify-center rounded-xl font-mono text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  day === selected
                    ? "bg-primary font-bold text-primary-foreground"
                    : "hover:bg-white/5",
                  day === today && day !== selected && "ring-1 ring-primary/60",
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
  );
}
