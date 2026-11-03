"use client";

import { Clock, Play } from "lucide-react";
import {
  useFormatter,
  useTranslations,
  type DateTimeFormatOptions,
} from "next-intl";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { momentOfMinute } from "@/config/moments";
import { Link, useRouter } from "@/i18n/navigation";
import { clockDate, toDbDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { planWeek, sessionOn, weekOf, type CalendarPlan } from "../calendar";
import { PLAN_LIBRARY } from "../catalogue";
import { dayStatus, itemParts, nextSessions } from "../plan-today";
import type { DevelopmentKind } from "../questionnaires";
import { ItemEditDialog } from "./item-edit-dialog";
import { SessionRunner } from "./session-runner";

/**
 * Onglet « Mon plan », design « Aujourd'hui » (décision du fondateur,
 * 2026-11-02) : les 7 jours de la semaine, la séance du jour choisi en grand,
 * ses éléments en cartes (vers leur fiche du catalogue), « Commencer », puis
 * les prochaines séances.
 */
export function PlanToday({
  kind,
  plan,
  today,
}: {
  kind: DevelopmentKind;
  plan: CalendarPlan;
  today: string;
}) {
  const t = useTranslations("Development.plan.today");
  const tMoments = useTranslations("Development.calendar.moments");
  const format = useFormatter();
  const router = useRouter();
  const root = useRef<HTMLDivElement>(null);
  const [day, setDay] = useState(today);
  const [running, setRunning] = useState(false);
  const [editing, setEditing] = useState(false);

  const session = sessionOn(plan, day);
  const status = dayStatus(plan, day);
  const library = PLAN_LIBRARY[kind]?.kind ?? null;
  const week = planWeek(plan, today);
  const items = session
    ? session.items.map((item) => ({ ...itemParts(item), ref: item.ref }))
    : [];
  const upcoming = nextSessions(plan, day);
  const date = (value: string, options: DateTimeFormatOptions) =>
    format.dateTime(toDbDate(value), { ...options, timeZone: "UTC" });
  const moment = session
    ? session.time !== null
      ? momentOfMinute(session.time)
      : session.moment
    : null;
  const clock =
    session && session.time !== null
      ? format.dateTime(clockDate(session.time), {
          hour: "numeric",
          minute: "2-digit",
          timeZone: "UTC",
        })
      : null;
  const weekLabel = week
    ? t("week", { week: week.week, weeks: week.weeks })
    : null;

  function select(value: string) {
    setDay(value);
    root.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div ref={root} className="flex scroll-mt-24 flex-col gap-6">
      <div
        role="group"
        aria-label={t("daysLabel")}
        className="grid grid-cols-7 gap-1.5"
      >
        {weekOf(today).map((value) => {
          const planned = sessionOn(plan, value) !== null;
          const selected = value === day;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={selected}
              aria-label={date(value, {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
              onClick={() => setDay(value)}
              className={cn(
                "flex h-16 flex-col items-center justify-center gap-1 rounded-2xl border outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                selected
                  ? "border-primary bg-primary text-primary-foreground"
                  : planned
                    ? "border-foreground/10 hover:bg-foreground/[0.04]"
                    : "border-transparent text-muted-foreground hover:bg-foreground/[0.04]",
              )}
            >
              <span className="text-[11px] font-semibold capitalize">
                {date(value, { weekday: "narrow" })}
              </span>
              <span
                className={cn(
                  "font-display text-[22px] leading-none tabular-nums",
                  !selected && value === today && "text-primary",
                )}
              >
                {date(value, { day: "numeric" })}
              </span>
            </button>
          );
        })}
      </div>

      <header className="flex flex-col gap-3">
        <div className="flex items-end gap-3.5">
          {clock ? (
            <span className="font-display text-6xl leading-[0.9] text-primary tabular-nums">
              {clock}
            </span>
          ) : null}
          <span className="flex min-w-0 flex-1 flex-col gap-0.5 pb-1">
            <span className="caps-label">
              {day === today
                ? t("today")
                : date(day, { weekday: "long", day: "numeric", month: "long" })}
            </span>
            {session ? (
              <span className="caps-label text-muted-foreground">
                {tMoments(moment ?? "none")}
              </span>
            ) : null}
          </span>
          {session ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              aria-label={t("editSession", { title: session.title })}
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-foreground/[0.06] text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Clock aria-hidden="true" className="size-5" />
            </button>
          ) : null}
        </div>
        <h2 className="font-display text-5xl leading-[0.98] tracking-wide text-balance uppercase">
          {session
            ? session.title
            : t(kind === "physical" ? "rest" : "nothing")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {session
            ? [t(`items.${kind}`, { count: session.items.length }), weekLabel]
                .filter(Boolean)
                .join(" · ")
            : status === "before"
              ? t("before", {
                  date: date(plan.startsOn, { day: "numeric", month: "long" }),
                })
              : status === "after"
                ? t("after", {
                    date: date(plan.endsOn, { day: "numeric", month: "long" }),
                  })
                : t("restText")}
        </p>
        {!session && upcoming[0] ? (
          <Button
            variant="outline"
            className="w-fit"
            onClick={() => select(upcoming[0]?.day ?? day)}
          >
            {t("nextSession", {
              day: date(upcoming[0].day, { weekday: "long" }),
              title: upcoming[0].session.title,
            })}
          </Button>
        ) : null}
      </header>

      {items.length > 0 ? (
        <ol className="flex flex-col gap-2.5">
          {items.map((item, index) => {
            const body = (
              <>
                <span className="w-10 shrink-0 font-display text-3xl leading-none text-primary tabular-nums">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  {item.kicker ? (
                    <span className="caps-label text-muted-foreground">
                      {item.kicker}
                    </span>
                  ) : null}
                  <span className="leading-snug font-semibold">
                    {item.name}
                  </span>
                  {item.sub ? (
                    <span className="text-xs text-muted-foreground">
                      {item.sub}
                    </span>
                  ) : null}
                </span>
                {item.ref && library ? (
                  <span
                    aria-hidden="true"
                    className="flex size-14 shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl bg-primary/15 text-[10px] font-bold tracking-wide text-primary uppercase"
                  >
                    <Play className="size-4 fill-current" />
                    {t(`media.${library}`)}
                  </span>
                ) : null}
              </>
            );
            const card =
              "flex items-center gap-3.5 rounded-[22px] border border-foreground/8 bg-raised p-3.5";
            return (
              <li key={`${item.name}-${index}`}>
                {item.ref ? (
                  <Link
                    href={`/services/library/${item.ref}`}
                    className={cn(
                      card,
                      "outline-none hover:bg-foreground/[0.04] focus-visible:ring-3 focus-visible:ring-ring/50",
                    )}
                  >
                    {body}
                  </Link>
                ) : (
                  <div className={card}>{body}</div>
                )}
              </li>
            );
          })}
        </ol>
      ) : null}

      {session && items.length > 0 ? (
        <Button
          size="lg"
          className="h-14 w-full rounded-full text-base"
          onClick={() => setRunning(true)}
        >
          <Play aria-hidden="true" className="fill-current" />
          {t(`start.${kind}`)}
        </Button>
      ) : null}

      {upcoming.length > 0 ? (
        <section
          aria-labelledby="plan-next"
          className="flex flex-col gap-3 border-t border-foreground/8 pt-6"
        >
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="plan-next" className="caps-label text-muted-foreground">
              {t("next")}
            </h2>
            {weekLabel ? (
              <span className="text-xs text-muted-foreground">{weekLabel}</span>
            ) : null}
          </div>
          <div className="-mx-4 flex [scrollbar-width:none] gap-2.5 overflow-x-auto px-4 pb-1">
            {upcoming.map((entry) => (
              <button
                key={entry.day}
                type="button"
                onClick={() => select(entry.day)}
                className="flex w-40 shrink-0 flex-col gap-2 rounded-[20px] bg-foreground/[0.05] p-4 text-left outline-none hover:bg-foreground/[0.08] focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="caps-label text-primary">
                  {date(entry.day, { weekday: "short", day: "numeric" })}
                </span>
                <span className="leading-snug font-semibold">
                  {entry.session.title}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t(`items.${kind}`, { count: entry.session.items.length })}
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {session ? (
        <SessionRunner
          open={running}
          onOpenChange={setRunning}
          title={session.title}
          items={items}
          mediaLabel={library ? t(`see.${library}`) : null}
        />
      ) : null}
      {editing && session ? (
        <ItemEditDialog
          target={{ type: "session", plan, session }}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}
