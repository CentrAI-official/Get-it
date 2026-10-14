"use client";

import {
  Check,
  Flag,
  ListPlus,
  LoaderCircle,
  Plus,
  Repeat,
  Target,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Fragment, useState, useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ScheduleLabel } from "@/features/habits/components/schedule-label";
import { Link } from "@/i18n/navigation";
import { toDbDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { resolveCoachActionAction } from "../actions";
import type { CoachActionPayload, CoachActionView } from "../coach-tools";

const ICONS = {
  goal: Target,
  habit: Repeat,
  task: ListPlus,
  milestone: Flag,
} as const;

/** Page où retrouver l'élément une fois ajouté. */
function linkFor(payload: CoachActionPayload, createdId: string | null) {
  switch (payload.kind) {
    case "goal":
      return createdId ? `/goals/${createdId}` : "/goals";
    case "habit":
      return "/habits";
    case "task":
      return "/today";
    case "milestone":
      return `/goals/${payload.goal.id}`;
  }
}

type ActionCardProps = {
  action: CoachActionView;
  onChange: (action: CoachActionView) => void;
};

/** Proposition de Get iT AI : rien n'est créé sans « Ajouter ». */
export function ActionCard({ action, onChange }: ActionCardProps) {
  const t = useTranslations("Coach.actions");
  const tPillars = useTranslations("Pillars");
  const format = useFormatter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<
    "notFound" | "goalMissing" | "unexpected" | null
  >(null);
  const { payload, status } = action;
  const Icon = ICONS[payload.kind];

  // Jour du calendrier : formaté en UTC pour ne pas glisser d'un jour
  const date = (day: string) =>
    format.dateTime(toDbDate(day), {
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    });

  const meta: ReactNode[] = [];
  if (payload.kind === "goal" || payload.kind === "habit") {
    meta.push(tPillars(`${payload.pillar}.name`));
  }
  if (payload.kind === "habit") {
    meta.push(<ScheduleLabel weekdays={payload.weekdays} />);
  }
  if (payload.kind === "goal" && payload.targetDate) {
    meta.push(t("target", { date: date(payload.targetDate) }));
  }
  if (payload.kind === "task") {
    meta.push(
      payload.dueDate ? t("due", { date: date(payload.dueDate) }) : t("noDue"),
    );
  }
  if (payload.kind !== "goal" && payload.goal) {
    meta.push(t("goal", { goal: payload.goal.title }));
  }

  function resolve(decision: "apply" | "dismiss") {
    setError(null);
    startTransition(async () => {
      const result = await resolveCoachActionAction(action.id, decision);
      if (result.ok) {
        onChange({
          ...action,
          status: result.status,
          createdId: result.createdId,
        });
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <li
      data-action={payload.kind}
      className={cn(
        "flex flex-col gap-3 rounded-2xl border p-3 transition-colors",
        status === "applied"
          ? "border-primary/30 bg-primary/[0.06]"
          : "border-white/10 bg-white/[0.03]",
        status === "dismissed" && "opacity-60",
      )}
    >
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full orb">
          <Icon aria-hidden="true" className="size-4 text-silver" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {t(`kinds.${payload.kind}`)}
          </span>
          <span className="font-semibold break-words">{payload.title}</span>
          {meta.length > 0 ? (
            <span className="text-xs break-words text-muted-foreground">
              {meta.map((part, index) => (
                <Fragment key={index}>
                  {index > 0 ? " · " : null}
                  {part}
                </Fragment>
              ))}
            </span>
          ) : null}
        </div>
      </div>

      {status === "pending" ? (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={pending} onClick={() => resolve("apply")}>
            {pending ? (
              <LoaderCircle aria-hidden="true" className="animate-spin" />
            ) : (
              <Plus aria-hidden="true" />
            )}
            {t("add")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => resolve("dismiss")}
          >
            {t("dismiss")}
          </Button>
        </div>
      ) : status === "applied" ? (
        <p
          role="status"
          className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"
        >
          <span className="flex items-center gap-1.5 text-primary">
            <Check aria-hidden="true" className="size-4" />
            {t("added")}
          </span>
          <Link
            href={linkFor(payload, action.createdId)}
            className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            {t("view")}
          </Link>
        </p>
      ) : (
        <p role="status" className="text-sm text-muted-foreground">
          {t("dismissed")}
        </p>
      )}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {t(`errors.${error}`)}
        </p>
      ) : null}
    </li>
  );
}
