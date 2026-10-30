"use client";

import {
  Check,
  ChevronDown,
  Clock,
  Flag,
  Pencil,
  Repeat,
  Trash2,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import {
  SwipeAction,
  SwipeRow,
  swipeActionClass,
} from "@/components/swipe-row";
import { Button } from "@/components/ui/button";
import { deleteEventAction } from "@/features/events/actions";
import { eventSpan, type CalendarEvent } from "@/features/events/rules";
import { deleteTaskAction } from "@/features/tasks/actions";
import { TaskEditDialog } from "@/features/tasks/components/task-edit-dialog";
import { Link } from "@/i18n/navigation";
import { addDays, clockDate, toDbDate } from "@/lib/dates";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DAY_MOMENTS, momentIcons, type DayMoment } from "@/config/moments";
import { cn } from "@/lib/utils";
import type {
  CalendarTask,
  MomentChange,
  TimelineGroup,
  TimelineItem,
} from "../calendar";
import { colorsOf } from "../colors";
import type { DevelopmentKind } from "../questionnaires";

/** Plan d'origine d'un élément du jour (null : hors plan). */
export function kindOfItem(item: TimelineItem): DevelopmentKind | null {
  switch (item.type) {
    case "session":
      return item.plan.kind;
    case "habit":
      return item.habit.planKind;
    case "task":
      return item.task.planKind;
    case "goal":
      return item.goal.planKind;
    case "event":
      return null;
  }
}

/** Ce qu'il faut pour cocher un élément : état affiché et règle du jour. */
type ItemState = { done: boolean; editable: boolean; hint: string | null };

type CalendarDayProps = {
  /** Le jour affiché, « AAAA-MM-JJ ». */
  day: string;
  groups: TimelineGroup[];
  /** Tout le calendrier (accueil) : le nom du plan est rappelé sur chaque élément. */
  showPlan: boolean;
  stateOf: (item: TimelineItem) => ItemState | null;
  onToggle: (item: TimelineItem, done: boolean) => void;
  onMoment: (change: MomentChange, key: string) => void;
  /** Un événement ou une tâche a été modifié ou supprimé : le mois se recharge. */
  onChanged: () => void;
};

/**
 * Le jour choisi : matin, midi, soir, puis ce qui se fait dans la journée. Un
 * événement ou une tâche se glisse vers la droite pour le modifier ou le supprimer.
 */
export function CalendarDay({
  day,
  groups,
  showPlan,
  stateOf,
  onToggle,
  onMoment,
  onChanged,
}: CalendarDayProps) {
  const t = useTranslations("Development.calendar");
  // Retirés tout de suite, en attendant la réponse du serveur
  const [removed, setRemoved] = useState<string[]>([]);
  const [editing, setEditing] = useState<CalendarTask | null>(null);
  const [, startTransition] = useTransition();

  function remove(item: TimelineItem) {
    setRemoved((current) => [...current, item.key]);
    startTransition(async () => {
      if (item.type === "event") {
        const deleted = await deleteEventAction(item.event.id);
        if (!deleted) {
          setRemoved((current) => current.filter((key) => key !== item.key));
        }
      } else if (item.type === "task") {
        await deleteTaskAction(item.task.id);
      }
      onChanged();
    });
  }

  const deleteButton = (item: TimelineItem, title: string) => (
    <SwipeAction
      tone="danger"
      aria-label={t("deleteLabel", { title })}
      onClick={() => remove(item)}
    >
      <Trash2 aria-hidden="true" />
      {t("delete")}
    </SwipeAction>
  );

  return (
    <div className="flex flex-col gap-3">
      {groups.map((group) => {
        const Icon = group.moment ? momentIcons[group.moment] : Clock;
        return (
          <section
            key={group.moment ?? "none"}
            className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-2.5"
          >
            <h5 className="flex items-start gap-1.5 pt-3.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              <Icon aria-hidden="true" className="size-3.5 shrink-0" />
              <span className="break-words">
                {t(`moments.${group.moment ?? "none"}`)}
              </span>
            </h5>
            <ul className="flex flex-col gap-1.5">
              {group.items
                .filter((item) => !removed.includes(item.key))
                .map((item) => {
                  if (item.type === "event") {
                    return (
                      <li key={item.key}>
                        <SwipeRow
                          actions={
                            <>
                              <Link
                                href={`/services/events/${item.event.id}`}
                                aria-label={t("editLabel", {
                                  title: item.event.title,
                                })}
                                className={swipeActionClass}
                              >
                                <Pencil aria-hidden="true" />
                                {t("edit")}
                              </Link>
                              {deleteButton(item, item.event.title)}
                            </>
                          }
                        >
                          <EventItem event={item.event} day={day} />
                        </SwipeRow>
                      </li>
                    );
                  }
                  const row = (
                    <DayItem
                      item={item}
                      moment={group.moment}
                      showPlan={showPlan}
                      state={stateOf(item)}
                      onToggle={onToggle}
                      onMoment={onMoment}
                    />
                  );
                  return (
                    <li key={item.key}>
                      {item.type === "task" ? (
                        <SwipeRow
                          actions={
                            <>
                              <SwipeAction
                                aria-label={t("editLabel", {
                                  title: item.task.title,
                                })}
                                onClick={() => setEditing(item.task)}
                              >
                                <Pencil aria-hidden="true" />
                                {t("edit")}
                              </SwipeAction>
                              {deleteButton(item, item.task.title)}
                            </>
                          }
                        >
                          {row}
                        </SwipeRow>
                      ) : (
                        row
                      )}
                    </li>
                  );
                })}
            </ul>
          </section>
        );
      })}

      {editing ? (
        <TaskEditDialog
          task={editing}
          open
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
          onSaved={() => {
            setEditing(null);
            onChanged();
          }}
        />
      ) : null}
    </div>
  );
}

/** Un événement du calendrier personnel, avec son heure en grand. */
function EventItem({ event, day }: { event: CalendarEvent; day: string }) {
  const t = useTranslations("Development.calendar");
  const tEvents = useTranslations("Events");
  const format = useFormatter();
  const time = (minute: number) =>
    format.dateTime(clockDate(minute), {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "UTC",
    });
  const span = eventSpan(event);
  const meta = [
    t("event"),
    event.location,
    event.repeat === "none" ? null : tEvents(`repeatShort.${event.repeat}`),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex min-h-14 items-center gap-3 rounded-2xl bg-foreground/5 py-2 pr-3 pl-3.5">
      <span className="flex w-[4.75rem] shrink-0 flex-col">
        <span className="font-display text-[1.6rem] leading-none whitespace-nowrap text-primary">
          {time(event.startMinute)}
        </span>
        <span className="mt-1 text-[11px] whitespace-nowrap text-muted-foreground">
          {span > 0
            ? t("untilDay", {
                date: format.dateTime(toDbDate(addDays(day, span)), {
                  day: "numeric",
                  month: "short",
                  timeZone: "UTC",
                }),
              })
            : t("until", { time: time(event.endMinute) })}
        </span>
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 py-1">
        <span className="font-semibold break-words">{event.title}</span>
        <span className="text-xs break-words text-muted-foreground">
          {meta}
        </span>
      </span>
      {event.repeat === "none" ? null : (
        <Repeat
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground"
        />
      )}
    </div>
  );
}

type DayItemProps = {
  /** Séance, habitude, tâche ou objectif (les événements ont leur propre ligne). */
  item: Exclude<TimelineItem, { type: "event" }>;
  moment: DayMoment | null;
  showPlan: boolean;
  state: ItemState | null;
  onToggle: (item: TimelineItem, done: boolean) => void;
  onMoment: (change: MomentChange, key: string) => void;
};

/** Un élément du jour, sur un fond de la couleur de son plan. */
function DayItem({
  item,
  moment,
  showPlan,
  state,
  onToggle,
  onMoment,
}: DayItemProps) {
  const t = useTranslations("Development.calendar");
  const tKinds = useTranslations("Development.kinds");
  const [open, setOpen] = useState(false);
  const kind = kindOfItem(item);
  const colors = colorsOf(kind);
  const planName = kind && showPlan ? tKinds(`${kind}.title`) : null;

  const title =
    item.type === "session"
      ? item.session.title
      : item.type === "habit"
        ? item.habit.title
        : item.type === "task"
          ? item.task.title
          : item.goal.title;
  const typeLabel =
    item.type === "session"
      ? t("exercises", { count: item.session.items.length })
      : item.type === "habit"
        ? t("habit")
        : item.type === "task"
          ? t("task")
          : t(item.goal.done ? "goalDone" : "goalDue");
  const meta = planName ? `${planName} · ${typeLabel}` : typeLabel;
  const done = state?.done ?? false;

  const change: MomentChange | null =
    item.type === "session"
      ? {
          type: "session",
          kind: item.plan.kind,
          weekday: item.session.weekday,
          moment,
        }
      : item.type === "habit"
        ? { type: "habit", id: item.habit.id, moment }
        : item.type === "task"
          ? { type: "task", id: item.task.id, moment }
          : null;

  return (
    <div
      className={cn(
        "flex flex-col rounded-2xl py-1.5 pr-1.5 pl-3.5 transition-colors",
        colors.tint,
      )}
    >
      <div className="flex min-h-11 items-center gap-2">
        {item.type === "goal" ? (
          <Flag aria-hidden="true" className="size-4 shrink-0 text-silver" />
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 py-1">
          <span
            className={cn(
              "font-semibold break-words",
              done && "text-muted-foreground line-through",
            )}
          >
            {title}
          </span>
          <span
            className={cn(
              "text-xs break-words",
              done ? "text-muted-foreground" : colors.text,
            )}
          >
            {meta}
          </span>
          {state?.hint ? (
            <span className="text-xs text-muted-foreground">{state.hint}</span>
          ) : null}
        </div>

        {item.type === "session" && item.session.items.length > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-expanded={open}
            aria-label={t(open ? "hideSession" : "showSession", { title })}
            onClick={() => setOpen(!open)}
            className="size-10 shrink-0 rounded-full text-muted-foreground"
          >
            <ChevronDown
              aria-hidden="true"
              className={cn(
                "size-5 transition-transform",
                open && "rotate-180",
              )}
            />
          </Button>
        ) : null}

        {change ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t("momentMenu", { title })}
                className="size-10 shrink-0 rounded-full text-muted-foreground"
              >
                <Clock aria-hidden="true" className="size-[18px]" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuRadioGroup
                value={moment ?? "none"}
                onValueChange={(value) =>
                  onMoment(
                    {
                      ...change,
                      moment: value === "none" ? null : (value as DayMoment),
                    },
                    item.key,
                  )
                }
              >
                {[...DAY_MOMENTS, "none" as const].map((value) => (
                  <DropdownMenuRadioItem key={value} value={value}>
                    {t(`moments.${value}`)}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}

        {state?.editable ? (
          <button
            type="button"
            aria-pressed={done}
            aria-label={t(done ? "uncheck" : "check", { title })}
            onClick={() => onToggle(item, !done)}
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-full border-2 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              done
                ? "border-primary bg-primary text-primary-foreground glow-primary"
                : "border-foreground/30",
            )}
          >
            {done ? (
              <Check aria-hidden="true" className="size-5" strokeWidth={3} />
            ) : null}
          </button>
        ) : null}
      </div>

      {item.type === "session" && open ? (
        <ul className="flex flex-col gap-1.5 pt-1 pr-2 pb-2">
          {item.session.items.map((entry, index) => (
            <li key={`${entry.name}-${index}`} className="text-sm">
              <span className="font-medium">{entry.name}</span>
              {entry.detail ? (
                <span className="text-muted-foreground"> — {entry.detail}</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
