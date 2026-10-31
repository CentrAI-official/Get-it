"use client";

import { LoaderCircle, Sparkles } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { TimeWheel } from "@/components/time-wheel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DAY_MOMENTS,
  momentIcons,
  momentOfMinute,
  type DayMoment,
} from "@/config/moments";
import { ITEM_TITLE_MAX_LENGTH } from "@/features/goals/schemas";
import { HABIT_TITLE_MAX_LENGTH } from "@/features/habits/schemas";
import { WEEKDAY_DATES } from "@/features/habits/weekdays";
import { Link } from "@/i18n/navigation";
import { clockDate, formatClock, parseClock } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { saveItemAction, suggestItemEditAction } from "../actions";
import type { CalendarHabit, CalendarPlan, CalendarTask } from "../calendar";
import { ITEM_AI_REQUEST_MAX } from "../item-ai";
import { SESSION_TITLE_MAX_LENGTH } from "../plan";

/** Ce que « Modifier » peut changer : une tâche, une habitude ou une séance de plan. */
export type EditTarget =
  | { type: "task"; task: CalendarTask }
  | { type: "habit"; habit: CalendarHabit }
  | {
      type: "session";
      plan: CalendarPlan;
      session: CalendarPlan["schedule"][number];
    };

type ItemEditDialogProps = {
  target: EditTarget;
  onClose: () => void;
  /** Enregistré : le calendrier se recharge. */
  onSaved: () => void;
};

const itemOf = (target: EditTarget) =>
  target.type === "task"
    ? target.task
    : target.type === "habit"
      ? target.habit
      : target.session;

/** Heure proposée quand on en ajoute une : celle du moment choisi, sinon 9 h. */
const DEFAULT_CLOCK: Record<DayMoment, string> = {
  morning: "08:00",
  noon: "12:00",
  evening: "18:00",
};

/**
 * « Modifier » dans le calendrier : le titre, l'heure (roulette) ou, sans
 * heure, le moment de la journée ; l'échéance d'une tâche, les jours d'une
 * habitude. « Modifier avec Get iT AI » remplit ces champs d'après ce que la
 * personne écrit ; rien n'est enregistré avant « Enregistrer ».
 */
export function ItemEditDialog({
  target,
  onClose,
  onSaved,
}: ItemEditDialogProps) {
  const t = useTranslations("Development.calendar.itemEdit");
  const tMoments = useTranslations("Development.calendar.moments");
  const tErrors = useTranslations("Goals.errors");
  const format = useFormatter();
  const id = useId();
  const current = itemOf(target);
  const [title, setTitle] = useState(current.title);
  const [dueDate, setDueDate] = useState(
    target.type === "task" ? target.task.dueDate : "",
  );
  const [weekdays, setWeekdays] = useState<number[]>(
    target.type === "habit" ? target.habit.weekdays : [],
  );
  const [time, setTime] = useState(
    current.time === null ? "" : formatClock(current.time),
  );
  const [moment, setMoment] = useState<DayMoment | null>(current.moment);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const minute = parseClock(time);
  const titleMax =
    target.type === "task"
      ? ITEM_TITLE_MAX_LENGTH
      : target.type === "habit"
        ? HABIT_TITLE_MAX_LENGTH
        : SESSION_TITLE_MAX_LENGTH;

  function save() {
    setError(null);
    const fields = { title, time: minute, moment };
    const change =
      target.type === "task"
        ? { type: "task", id: target.task.id, dueDate, ...fields }
        : target.type === "habit"
          ? { type: "habit", id: target.habit.id, weekdays, ...fields }
          : {
              type: "session",
              kind: target.plan.kind,
              weekday: target.session.weekday,
              ...fields,
            };
    startTransition(async () => {
      const result = await saveItemAction(change);
      if (result.ok) onSaved();
      else setError(tErrors(result.error));
    });
  }

  function toggleWeekday(weekday: number) {
    setWeekdays((days) =>
      days.includes(weekday)
        ? // Au moins un jour reste choisi
          days.length > 1
          ? days.filter((day) => day !== weekday)
          : days
        : [...days, weekday].sort((a, b) => a - b),
    );
  }

  return (
    <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {target.type === "task" ? t("taskDescription") : current.title}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
          className="flex flex-col gap-4"
        >
          <AiEdit
            target={target}
            onSuggestion={(suggestion) => {
              setTitle(suggestion.title);
              setTime(
                suggestion.time === null ? "" : formatClock(suggestion.time),
              );
              setMoment(suggestion.moment);
              if (target.type === "task") setDueDate(suggestion.dueDate ?? "");
              if (target.type === "habit" && suggestion.weekdays.length > 0) {
                setWeekdays(suggestion.weekdays);
              }
            }}
          />

          <div className="flex flex-col gap-2">
            <Label htmlFor={`${id}-title`}>{t("name")}</Label>
            <Input
              id={`${id}-title`}
              name="title"
              value={title}
              maxLength={titleMax}
              required
              onChange={(change) => setTitle(change.target.value)}
              className="h-11"
            />
          </div>

          {target.type === "task" ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${id}-due`}>{t("due")}</Label>
              <Input
                id={`${id}-due`}
                name="dueDate"
                type="date"
                value={dueDate}
                onChange={(change) => setDueDate(change.target.value)}
                className="h-11"
              />
            </div>
          ) : null}

          {target.type === "habit" ? (
            <div className="flex flex-col gap-2">
              <span id={`${id}-days`} className="text-sm font-medium">
                {t("days")}
              </span>
              <div
                role="group"
                aria-labelledby={`${id}-days`}
                className="grid max-w-sm grid-cols-7 gap-1.5"
              >
                {WEEKDAY_DATES.map(({ weekday, date }) => {
                  const selected = weekdays.includes(weekday);
                  return (
                    <button
                      key={weekday}
                      type="button"
                      aria-pressed={selected}
                      aria-label={format.dateTime(date, {
                        weekday: "long",
                        timeZone: "UTC",
                      })}
                      onClick={() => toggleWeekday(weekday)}
                      className={cn(
                        "flex aspect-square items-center justify-center rounded-full border text-sm font-medium uppercase transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {format.dateTime(date, {
                        weekday: "narrow",
                        timeZone: "UTC",
                      })}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span id={`${id}-time`} className="text-sm font-medium">
                {t("time")}
              </span>
              {time ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setTime("")}
                >
                  {t("clearTime")}
                </Button>
              ) : null}
            </div>
            {time ? (
              <TimeWheel
                value={time}
                onChange={setTime}
                labelledBy={`${id}-time`}
              />
            ) : (
              <Button
                type="button"
                variant="outline"
                className="h-11 w-fit"
                onClick={() =>
                  setTime(moment ? DEFAULT_CLOCK[moment] : "09:00")
                }
              >
                {t("addTime")}
              </Button>
            )}
            <p className="text-sm text-muted-foreground">
              {minute === null
                ? t("noTimeHint")
                : t("timeHint", {
                    time: format.dateTime(clockDate(minute), {
                      hour: "numeric",
                      minute: "2-digit",
                      timeZone: "UTC",
                    }),
                    moment: tMoments(momentOfMinute(minute)),
                  })}
            </p>
          </div>

          {/* Sans heure : le moment de la journée range l'élément */}
          {minute === null ? (
            <div
              role="radiogroup"
              aria-label={t("moment")}
              className="flex flex-wrap gap-2"
            >
              {[...DAY_MOMENTS, null].map((value) => {
                const Icon = value ? momentIcons[value] : null;
                const active = moment === value;
                return (
                  <button
                    key={value ?? "none"}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setMoment(value)}
                    className={cn(
                      "flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      active
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-input text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {Icon ? (
                      <Icon aria-hidden="true" className="size-4" />
                    ) : null}
                    {tMoments(value ?? "none")}
                  </button>
                );
              })}
            </div>
          ) : null}

          {target.type === "habit" ? (
            <Link
              href={`/habits/${target.habit.id}/edit`}
              className="w-fit text-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {t("habitSettings")}
            </Link>
          ) : target.type === "session" ? (
            <Link
              href={`/services/${target.plan.kind}`}
              className="w-fit text-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {t("planLink")}
            </Link>
          ) : null}

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? (
                <LoaderCircle aria-hidden="true" className="animate-spin" />
              ) : null}
              {t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type Suggestion = Extract<
  Awaited<ReturnType<typeof suggestItemEditAction>>,
  { ok: true }
>["suggestion"];

/**
 * « Modifier avec Get iT AI » : la personne écrit ce qu'elle veut changer,
 * Get iT AI remplit les champs dessous, et elle vérifie avant d'enregistrer.
 */
function AiEdit({
  target,
  onSuggestion,
}: {
  target: EditTarget;
  onSuggestion: (suggestion: Suggestion) => void;
}) {
  const t = useTranslations("Development.calendar.itemEdit.ai");
  const id = useId();
  const [open, setOpen] = useState(false);
  const [request, setRequest] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [failure, setFailure] = useState<
    | Extract<
        Awaited<ReturnType<typeof suggestItemEditAction>>,
        { ok: false }
      >["error"]
    | null
  >(null);
  const [pending, startTransition] = useTransition();

  function ask() {
    setFailure(null);
    setNote(null);
    const where =
      target.type === "task"
        ? { type: "task", id: target.task.id }
        : target.type === "habit"
          ? { type: "habit", id: target.habit.id }
          : {
              type: "session",
              kind: target.plan.kind,
              weekday: target.session.weekday,
            };
    startTransition(async () => {
      const result = await suggestItemEditAction({ target: where, request });
      if (!result.ok) {
        setFailure(result.error);
        return;
      }
      onSuggestion(result.suggestion);
      setNote(result.suggestion.summary || t("filled"));
      setRequest("");
      setOpen(false);
    });
  }

  return (
    <div className="flex flex-col gap-2 border-b border-foreground/8 pb-4">
      {open ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-request`}>{t("question")}</Label>
          <textarea
            id={`${id}-request`}
            autoFocus
            rows={2}
            value={request}
            maxLength={ITEM_AI_REQUEST_MAX}
            placeholder={t(`placeholder.${target.type}`)}
            onChange={(change) => setRequest(change.target.value)}
            onKeyDown={(event) => {
              // Entrée envoie la demande (Maj + Entrée : nouvelle ligne)
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                if (request.trim() && !pending) ask();
              }
            }}
            className="resize-none rounded-xl border border-input bg-transparent px-3 py-2 text-base outline-none placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={pending || !request.trim()}
              onClick={ask}
            >
              {pending ? (
                <LoaderCircle aria-hidden="true" className="animate-spin" />
              ) : (
                <Sparkles aria-hidden="true" />
              )}
              {pending ? t("thinking") : t("ask")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              {t("cancel")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t("privacy")}</p>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="w-fit"
          onClick={() => setOpen(true)}
        >
          <Sparkles aria-hidden="true" className="text-primary" />
          {t("open")}
        </Button>
      )}
      {note ? (
        <p role="status" className="text-sm">
          <span className="font-medium">{note}</span>{" "}
          <span className="text-muted-foreground">{t("review")}</span>
        </p>
      ) : null}
      {failure ? (
        <p role="alert" className="text-sm text-destructive">
          {t(`errors.${failure}`)}{" "}
          {failure === "consentRequired" ? (
            <Link
              href="/coach"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {t("consentLink")}
            </Link>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
