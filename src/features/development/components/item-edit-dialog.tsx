"use client";

import { LoaderCircle } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
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
import { Link } from "@/i18n/navigation";
import { clockDate, formatClock, parseClock } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { saveItemAction } from "../actions";
import type { CalendarHabit, CalendarPlan, CalendarTask } from "../calendar";

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

const scheduleOf = (target: EditTarget) =>
  target.type === "task"
    ? target.task
    : target.type === "habit"
      ? target.habit
      : target.session;

/**
 * « Modifier » dans le calendrier : l'heure (ou, sans heure, le moment de la
 * journée) ; pour une tâche, aussi son titre et son échéance. Le reste d'une
 * habitude ou d'un plan se change sur sa propre page.
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
  const current = scheduleOf(target);
  const [title, setTitle] = useState(
    target.type === "task" ? target.task.title : "",
  );
  const [dueDate, setDueDate] = useState(
    target.type === "task" ? target.task.dueDate : "",
  );
  const [time, setTime] = useState(
    current.time === null ? "" : formatClock(current.time),
  );
  const [moment, setMoment] = useState<DayMoment | null>(current.moment);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const minute = parseClock(time);

  const name =
    target.type === "task"
      ? target.task.title
      : target.type === "habit"
        ? target.habit.title
        : target.session.title;

  function save() {
    setError(null);
    const schedule = { time: minute, moment };
    const change =
      target.type === "task"
        ? { type: "task", id: target.task.id, title, dueDate, ...schedule }
        : target.type === "habit"
          ? { type: "habit", id: target.habit.id, ...schedule }
          : {
              type: "session",
              kind: target.plan.kind,
              weekday: target.session.weekday,
              ...schedule,
            };
    startTransition(async () => {
      const result = await saveItemAction(change);
      if (result.ok) onSaved();
      else setError(tErrors(result.error));
    });
  }

  return (
    <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {target.type === "task" ? t("taskDescription") : name}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
          className="flex flex-col gap-4"
        >
          {target.type === "task" ? (
            <>
              <div className="flex flex-col gap-2">
                <Label htmlFor={`${id}-title`}>{t("name")}</Label>
                <Input
                  id={`${id}-title`}
                  name="title"
                  value={title}
                  onChange={(change) => setTitle(change.target.value)}
                  maxLength={ITEM_TITLE_MAX_LENGTH}
                  required
                  className="h-11"
                />
              </div>
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
            </>
          ) : null}

          <div className="flex flex-col gap-2">
            <Label htmlFor={`${id}-time`}>{t("time")}</Label>
            <div className="flex gap-2">
              <Input
                id={`${id}-time`}
                name="time"
                type="time"
                value={time}
                onChange={(change) => setTime(change.target.value)}
                aria-describedby={`${id}-time-hint`}
                className="h-11 flex-1"
              />
              {time ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-11"
                  onClick={() => setTime("")}
                >
                  {t("clearTime")}
                </Button>
              ) : null}
            </div>
            <p id={`${id}-time-hint`} className="text-sm text-muted-foreground">
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
