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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { momentIcons } from "@/config/moments";
import { eventSpan, type CalendarEvent } from "@/features/events/rules";
import { Link } from "@/i18n/navigation";
import { addDays, clockDate, toDbDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { removeCalendarItemAction } from "../actions";
import {
  timeOfItem,
  type CalendarTarget,
  type TimelineGroup,
  type TimelineItem,
} from "../calendar";
import { colorsOf } from "../colors";
import type { DevelopmentKind } from "../questionnaires";
import { ItemEditDialog, type EditTarget } from "./item-edit-dialog";

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

const titleOf = (item: TimelineItem) => {
  switch (item.type) {
    case "session":
      return item.session.title;
    case "habit":
      return item.habit.title;
    case "task":
      return item.task.title;
    case "goal":
      return item.goal.title;
    case "event":
      return item.event.title;
  }
};

/** L'élément visé par « Supprimer », tel que le serveur le revalide. */
const targetOf = (item: TimelineItem): CalendarTarget => {
  switch (item.type) {
    case "session":
      return {
        type: "session",
        kind: item.plan.kind,
        weekday: item.session.weekday,
      };
    case "habit":
      return { type: "habit", id: item.habit.id };
    case "task":
      return { type: "task", id: item.task.id };
    case "goal":
      return { type: "goal", id: item.goal.id };
    case "event":
      return { type: "event", id: item.event.id };
  }
};

/** Ce que « Modifier » ouvre dans une fenêtre (les autres ont leur page). */
const editOf = (item: TimelineItem): EditTarget | null => {
  switch (item.type) {
    case "session":
      return { type: "session", plan: item.plan, session: item.session };
    case "habit":
      return { type: "habit", habit: item.habit };
    case "task":
      return { type: "task", task: item.task };
    default:
      return null;
  }
};

/** Page de modification des éléments qui en ont une. */
const editHref = (item: TimelineItem) =>
  item.type === "event"
    ? `/services/events/${item.event.id}`
    : item.type === "goal"
      ? `/goals/${item.goal.id}/edit`
      : null;

type CalendarDayProps = {
  /** Le jour affiché, « AAAA-MM-JJ ». */
  day: string;
  groups: TimelineGroup[];
  /** Tout le calendrier (accueil) : le nom du plan est rappelé sur chaque élément. */
  showPlan: boolean;
  stateOf: (item: TimelineItem) => ItemState | null;
  onToggle: (item: TimelineItem, done: boolean) => void;
  /** Un élément a été modifié ou supprimé : le mois se recharge. */
  onChanged: () => void;
};

/**
 * Le jour choisi : matin, midi, soir, puis ce qui se fait dans la journée. Ce
 * qui a une heure la montre en grand. Chaque élément se glisse vers la droite
 * pour le modifier (son heure) ou le supprimer.
 */
export function CalendarDay({
  day,
  groups,
  showPlan,
  stateOf,
  onToggle,
  onChanged,
}: CalendarDayProps) {
  const t = useTranslations("Development.calendar");
  // Retirés tout de suite, en attendant la réponse du serveur
  const [removed, setRemoved] = useState<string[]>([]);
  const [editing, setEditing] = useState<EditTarget | null>(null);
  // Habitude, objectif ou séance : on confirme avant de supprimer
  const [confirming, setConfirming] = useState<TimelineItem | null>(null);
  const [, startTransition] = useTransition();

  function remove(item: TimelineItem) {
    setRemoved((current) => [...current, item.key]);
    startTransition(async () => {
      const deleted = await removeCalendarItemAction(targetOf(item));
      if (!deleted) {
        setRemoved((current) => current.filter((key) => key !== item.key));
      }
      onChanged();
    });
  }

  function askRemove(item: TimelineItem) {
    if (item.type === "task" || item.type === "event") remove(item);
    else setConfirming(item);
  }

  function actionsOf(item: TimelineItem) {
    const title = titleOf(item);
    const href = editHref(item);
    const edit = editOf(item);
    return (
      <>
        {href ? (
          <Link
            href={href}
            aria-label={t("editLabel", { title })}
            className={swipeActionClass}
          >
            <Pencil aria-hidden="true" />
            {t("edit")}
          </Link>
        ) : (
          <SwipeAction
            aria-label={t("editLabel", { title })}
            onClick={() => setEditing(edit)}
          >
            <Pencil aria-hidden="true" />
            {t("edit")}
          </SwipeAction>
        )}
        <SwipeAction
          tone="danger"
          aria-label={t("deleteLabel", { title })}
          onClick={() => askRemove(item)}
        >
          <Trash2 aria-hidden="true" />
          {t("delete")}
        </SwipeAction>
      </>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {groups.map((group) => {
        const Icon = group.moment ? momentIcons[group.moment] : Clock;
        return (
          // Le moment au-dessus de ses lignes : elles gardent toute la largeur
          <section
            key={group.moment ?? "none"}
            className="flex flex-col gap-1.5"
          >
            <h5 className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              <Icon aria-hidden="true" className="size-3.5 shrink-0" />
              {t(`moments.${group.moment ?? "none"}`)}
            </h5>
            <ul className="flex flex-col gap-1.5">
              {group.items
                .filter((item) => !removed.includes(item.key))
                .map((item) => (
                  <li key={item.key}>
                    <SwipeRow actions={actionsOf(item)}>
                      {item.type === "event" ? (
                        <EventItem event={item.event} day={day} />
                      ) : (
                        <DayItem
                          item={item}
                          showPlan={showPlan}
                          state={stateOf(item)}
                          onToggle={onToggle}
                          onEdit={() => setEditing(editOf(item))}
                        />
                      )}
                    </SwipeRow>
                  </li>
                ))}
            </ul>
          </section>
        );
      })}

      {editing ? (
        <ItemEditDialog
          target={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onChanged();
          }}
        />
      ) : null}

      <RemoveConfirm
        item={confirming}
        onCancel={() => setConfirming(null)}
        onConfirm={(item) => {
          setConfirming(null);
          remove(item);
        }}
      />
    </div>
  );
}

/** Confirmation avant de supprimer une habitude, un objectif ou une séance. */
function RemoveConfirm({
  item,
  onCancel,
  onConfirm,
}: {
  item: TimelineItem | null;
  onCancel: () => void;
  onConfirm: (item: TimelineItem) => void;
}) {
  const t = useTranslations("Development.calendar.removeConfirm");
  const format = useFormatter();
  const description =
    item?.type === "habit"
      ? t("habit")
      : item?.type === "goal"
        ? t("goal")
        : item?.type === "session"
          ? t("session", {
              // 2024-01-01 est un lundi : le jour de la semaine de la séance
              weekday: format.dateTime(
                toDbDate(addDays("2024-01-01", item.session.weekday - 1)),
                { weekday: "long", timeZone: "UTC" },
              ),
            })
          : "";

  return (
    <AlertDialog
      open={item !== null}
      onOpenChange={(open) => (open ? null : onCancel())}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("title", { title: item ? titleOf(item) : "" })}
          </AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => (item ? onConfirm(item) : null)}
          >
            {t("confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** L'heure en grand, à gauche d'un élément qui en a une. */
function HourColumn({ minute, below }: { minute: number; below?: string }) {
  const format = useFormatter();
  return (
    <span className="flex w-[4.75rem] shrink-0 flex-col">
      <span className="font-display text-[1.6rem] leading-none whitespace-nowrap text-primary">
        {format.dateTime(clockDate(minute), {
          hour: "numeric",
          minute: "2-digit",
          timeZone: "UTC",
        })}
      </span>
      {below ? (
        <span className="mt-1 text-[11px] whitespace-nowrap text-muted-foreground">
          {below}
        </span>
      ) : null}
    </span>
  );
}

/** Un événement du calendrier personnel, avec son heure en grand. */
function EventItem({ event, day }: { event: CalendarEvent; day: string }) {
  const t = useTranslations("Development.calendar");
  const tEvents = useTranslations("Events");
  const format = useFormatter();
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
      <HourColumn
        minute={event.startMinute}
        below={
          span > 0
            ? t("untilDay", {
                date: format.dateTime(toDbDate(addDays(day, span)), {
                  day: "numeric",
                  month: "short",
                  timeZone: "UTC",
                }),
              })
            : t("until", {
                time: format.dateTime(clockDate(event.endMinute), {
                  hour: "numeric",
                  minute: "2-digit",
                  timeZone: "UTC",
                }),
              })
        }
      />
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
  showPlan: boolean;
  state: ItemState | null;
  onToggle: (item: TimelineItem, done: boolean) => void;
  /** Bouton horloge : changer l'heure (séance, habitude, tâche). */
  onEdit: () => void;
};

/** Un élément du jour, sur un fond de la couleur de son plan. */
function DayItem({ item, showPlan, state, onToggle, onEdit }: DayItemProps) {
  const t = useTranslations("Development.calendar");
  const tKinds = useTranslations("Development.kinds");
  const [open, setOpen] = useState(false);
  const kind = kindOfItem(item);
  const colors = colorsOf(kind);
  const planName = kind && showPlan ? tKinds(`${kind}.title`) : null;
  const title = titleOf(item);
  const time = timeOfItem(item);

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

  return (
    <div
      className={cn(
        "flex flex-col rounded-2xl py-1.5 pr-1.5 pl-3.5 transition-colors",
        colors.tint,
      )}
    >
      <div className="flex min-h-11 items-center gap-2">
        {time !== null ? <HourColumn minute={time} /> : null}
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

        {item.type === "goal" ? null : (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("timeButton", { title })}
            onClick={onEdit}
            className="size-10 shrink-0 rounded-full text-muted-foreground"
          >
            <Clock aria-hidden="true" className="size-[18px]" />
          </Button>
        )}

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
