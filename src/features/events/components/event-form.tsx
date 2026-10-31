"use client";

import { LoaderCircle, MapPin, Trash2 } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useActionState, useId, useState, useTransition } from "react";
import { TimeWheel } from "@/components/time-wheel";
import { Button } from "@/components/ui/button";
import {
  addDays,
  clockDate,
  daysBetween,
  formatClock,
  parseClock,
} from "@/lib/dates";
import { cn } from "@/lib/utils";
import {
  deleteEventAndReturnAction,
  saveEventAction,
  type EventFormState,
} from "../actions";
import {
  EVENT_LOCATION_MAX,
  EVENT_REPEATS,
  EVENT_TITLE_MAX,
  type CalendarEvent,
  type EventField,
  type EventRepeat,
} from "../rules";

type EventFormProps = {
  /** L'événement à modifier, ou null pour en ajouter un. */
  event: CalendarEvent | null;
  /** Début proposé pour un nouvel événement (jour et minute). */
  defaults: { day: string; minute: number };
};

const EPOCH = "2000-01-01";
const DAY_MINUTES = 24 * 60;

/** Jour et heure → minutes depuis une origine fixe (pour garder la durée). */
const toAbsolute = (day: string, time: string) => {
  const minute = parseClock(time);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && minute !== null
    ? daysBetween(EPOCH, day) * DAY_MINUTES + minute
    : null;
};
const fromAbsolute = (value: number) => ({
  day: addDays(EPOCH, Math.floor(value / DAY_MINUTES)),
  time: formatClock(((value % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES),
});

const FIELD =
  "h-11 min-w-0 rounded-lg bg-foreground/6 px-2.5 text-sm text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:ring-2 aria-invalid:ring-destructive/60";
/** La date prend la place libre ; l'heure garde sa largeur. */
const DATE_FIELD = cn(FIELD, "flex-1");
const TIME_FIELD = cn(FIELD, "w-28 shrink-0");

/**
 * Page « Ajouter un événement » : titre, lieu, début, fin et répétition, tout
 * sur une page. Changer le début déplace la fin : la durée reste la même.
 */
export function EventForm({ event, defaults }: EventFormProps) {
  const t = useTranslations("Events");
  const format = useFormatter();
  const locale = useLocale();
  const id = useId();
  const [state, formAction, pending] = useActionState<EventFormState, FormData>(
    saveEventAction.bind(null, event?.id ?? null),
    { status: "idle" },
  );
  const [deleting, startDelete] = useTransition();

  const start = event
    ? { day: event.startsOn, time: formatClock(event.startMinute) }
    : { day: defaults.day, time: formatClock(defaults.minute) };
  const end = event
    ? { day: event.endsOn, time: formatClock(event.endMinute) }
    : fromAbsolute((toAbsolute(start.day, start.time) ?? 0) + 60);

  const [title, setTitle] = useState(event?.title ?? "");
  const [location, setLocation] = useState(event?.location ?? "");
  const [startDate, setStartDate] = useState(start.day);
  const [startTime, setStartTime] = useState(start.time);
  const [endDate, setEndDate] = useState(end.day);
  const [endTime, setEndTime] = useState(end.time);
  const [repeat, setRepeat] = useState<EventRepeat>(event?.repeat ?? "none");
  // Roulette ouverte sous le début ou la fin (une seule à la fois)
  const [wheel, setWheel] = useState<"start" | "end" | null>(null);
  const clock = (value: string) => {
    const minute = parseClock(value);
    return minute === null
      ? value
      : format.dateTime(clockDate(minute), {
          hour: "numeric",
          minute: "2-digit",
          timeZone: "UTC",
        });
  };

  function moveStart(day: string, time: string) {
    const before = toAbsolute(startDate, startTime);
    const after = toAbsolute(day, time);
    const finish = toAbsolute(endDate, endTime);
    if (before !== null && after !== null && finish !== null) {
      const next = fromAbsolute(finish + after - before);
      setEndDate(next.day);
      setEndTime(next.time);
    }
    setStartDate(day);
    setStartTime(time);
  }

  const fieldError = (field: EventField) => state.fieldErrors?.[field];
  const errorText = (field: EventField) => {
    const key = fieldError(field);
    return key ? t(`errors.${key}`) : null;
  };
  const startError = errorText("startDate") ?? errorText("startTime");
  const endError = errorText("endDate") ?? errorText("endTime");

  return (
    <div className="flex flex-col gap-6">
      <form action={formAction} className="flex flex-col gap-5" noValidate>
        <input type="hidden" name="locale" value={locale} />

        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <label
            htmlFor={`${id}-title`}
            className="flex min-h-13 items-center gap-3 border-b border-border px-4"
          >
            <span className="w-14 shrink-0 text-sm font-medium text-muted-foreground">
              {t("title")}
            </span>
            <input
              id={`${id}-title`}
              name="title"
              value={title}
              onChange={(change) => setTitle(change.target.value)}
              maxLength={EVENT_TITLE_MAX}
              required
              autoComplete="off"
              placeholder={t("titlePlaceholder")}
              aria-invalid={fieldError("title") ? true : undefined}
              aria-describedby={
                fieldError("title") ? `${id}-title-error` : undefined
              }
              className="h-12 min-w-0 flex-1 bg-transparent text-base font-medium outline-none placeholder:text-muted-foreground/70"
            />
          </label>
          <label
            htmlFor={`${id}-location`}
            className="flex min-h-13 items-center gap-3 px-4"
          >
            <span className="w-14 shrink-0 text-sm font-medium text-muted-foreground">
              {t("location")}
            </span>
            <input
              id={`${id}-location`}
              name="location"
              value={location}
              onChange={(change) => setLocation(change.target.value)}
              maxLength={EVENT_LOCATION_MAX}
              autoComplete="off"
              placeholder={t("locationPlaceholder")}
              aria-invalid={fieldError("location") ? true : undefined}
              className="h-12 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground/70"
            />
            <MapPin
              aria-hidden="true"
              className="size-4 shrink-0 text-muted-foreground"
            />
          </label>
        </div>
        {errorText("title") ? (
          <p
            id={`${id}-title-error`}
            className="-mt-3 text-sm text-destructive"
          >
            {errorText("title")}
          </p>
        ) : null}
        {errorText("location") ? (
          <p className="-mt-3 text-sm text-destructive">
            {errorText("location")}
          </p>
        ) : null}

        <div className="flex flex-col gap-2">
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <div
              role="group"
              aria-labelledby={`${id}-start`}
              className="flex flex-col gap-2 border-b border-border px-4 py-3"
            >
              <span
                id={`${id}-start`}
                className="text-sm font-medium text-muted-foreground"
              >
                {t("start")}
              </span>
              <span className="flex gap-2">
                <input
                  type="date"
                  name="startDate"
                  aria-label={t("startDate")}
                  value={startDate}
                  onChange={(change) =>
                    moveStart(change.target.value, startTime)
                  }
                  required
                  aria-invalid={fieldError("startDate") ? true : undefined}
                  className={DATE_FIELD}
                />
                <input type="hidden" name="startTime" value={startTime} />
                <button
                  type="button"
                  aria-label={t("startTimeAt", { time: clock(startTime) })}
                  aria-expanded={wheel === "start"}
                  onClick={() => setWheel(wheel === "start" ? null : "start")}
                  className={cn(
                    TIME_FIELD,
                    "text-left tabular-nums",
                    wheel === "start" && "border-primary text-primary",
                  )}
                >
                  {clock(startTime)}
                </button>
              </span>
              {wheel === "start" ? (
                <TimeWheel
                  value={startTime}
                  onChange={(value) => moveStart(startDate, value)}
                  labelledBy={`${id}-start`}
                />
              ) : null}
            </div>
            <div
              role="group"
              aria-labelledby={`${id}-end`}
              className="flex flex-col gap-2 px-4 py-3"
            >
              <span
                id={`${id}-end`}
                className="text-sm font-medium text-muted-foreground"
              >
                {t("end")}
              </span>
              <span className="flex gap-2">
                <input
                  type="date"
                  name="endDate"
                  aria-label={t("endDate")}
                  value={endDate}
                  min={startDate}
                  onChange={(change) => setEndDate(change.target.value)}
                  required
                  aria-invalid={fieldError("endDate") ? true : undefined}
                  className={DATE_FIELD}
                />
                <input type="hidden" name="endTime" value={endTime} />
                <button
                  type="button"
                  aria-label={t("endTimeAt", { time: clock(endTime) })}
                  aria-expanded={wheel === "end"}
                  onClick={() => setWheel(wheel === "end" ? null : "end")}
                  className={cn(
                    TIME_FIELD,
                    "text-left tabular-nums",
                    wheel === "end" && "border-primary text-primary",
                  )}
                >
                  {clock(endTime)}
                </button>
              </span>
              {wheel === "end" ? (
                <TimeWheel
                  value={endTime}
                  onChange={setEndTime}
                  labelledBy={`${id}-end`}
                />
              ) : null}
            </div>
          </div>
          {startError ? (
            <p className="text-sm text-destructive">{startError}</p>
          ) : null}
          {endError ? (
            <p className="text-sm text-destructive">{endError}</p>
          ) : null}
        </div>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-3 text-sm font-medium">{t("repeat")}</legend>
          <div className="flex flex-wrap gap-2">
            {EVENT_REPEATS.map((value) => (
              <label
                key={value}
                className={cn(
                  "flex h-10 cursor-pointer items-center rounded-full border px-4 text-sm font-medium transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                  repeat === value
                    ? "border-primary bg-primary/14 text-primary"
                    : "border-border bg-card text-foreground hover:bg-foreground/5",
                )}
              >
                <input
                  type="radio"
                  name="repeat"
                  value={value}
                  checked={repeat === value}
                  onChange={() => setRepeat(value)}
                  className="sr-only"
                />
                {t(`repeats.${value}`)}
              </label>
            ))}
          </div>
        </fieldset>

        {state.error ? (
          <p role="alert" className="text-sm text-destructive">
            {t(`errors.${state.error}`)}
          </p>
        ) : null}

        <Button
          type="submit"
          size="lg"
          disabled={pending}
          className="h-12 w-full rounded-full text-base"
        >
          {pending ? (
            <LoaderCircle aria-hidden="true" className="animate-spin" />
          ) : null}
          {event ? t("save") : t("add")}
        </Button>
      </form>

      {event ? (
        <Button
          type="button"
          variant="ghost"
          disabled={deleting}
          onClick={() =>
            startDelete(async () => {
              await deleteEventAndReturnAction(event.id, locale);
            })
          }
          className="w-fit text-destructive hover:text-destructive"
        >
          <Trash2 aria-hidden="true" />
          {t("delete")}
        </Button>
      ) : null}
    </div>
  );
}
