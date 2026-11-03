"use client";

import {
  ChevronRight,
  CircleCheck,
  LoaderCircle,
  Plus,
  RefreshCw,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState, useTransition, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { WEEKDAY_DATES } from "@/features/habits/weekdays";
import { addDays } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { applyPlanAction, deletePlanAction } from "../actions";
import {
  DEFAULT_PLAN_DAYS,
  type CalendarData,
  type CalendarPlan,
} from "../calendar";
import type { DevelopmentPlan } from "../plan";
import type { DevelopmentKind } from "../questionnaires";
import { PlanToday } from "./plan-today";
import { RevisePlan } from "./revise-plan";

type PlanViewProps = {
  kind: DevelopmentKind;
  plan: DevelopmentPlan;
  updatedAt: string;
  /** Calendrier de ce plan (mois en cours). */
  calendar: CalendarData;
  onRedo: () => void;
  /** Détresse signalée pendant une modification : ressources d'aide. */
  onCrisis: () => void;
};

/**
 * Un plan de « Mon développement », design « Aujourd'hui » : la séance du
 * jour en grand, puis le plan en volets (à ajouter, repères, toute la
 * semaine, modifier avec Get iT AI).
 */
export function PlanView({
  kind,
  plan,
  updatedAt,
  calendar,
  onRedo,
  onCrisis,
}: PlanViewProps) {
  const t = useTranslations("Development.plan");
  const format = useFormatter();
  const stored = calendar.plans.find((entry) => entry.kind === kind);
  // La période vient du calendrier ; la semaine type, du plan affiché
  const planEntry: CalendarPlan = stored
    ? { ...stored, schedule: plan.schedule }
    : {
        id: kind,
        kind,
        title: plan.title,
        startsOn: calendar.today,
        endsOn: addDays(calendar.today, DEFAULT_PLAN_DAYS),
        schedule: plan.schedule,
      };
  const proposals =
    Number(plan.goal !== null) + plan.habits.length + plan.tasks.length;

  return (
    <article className="flex max-w-2xl flex-col gap-8">
      <PlanToday kind={kind} plan={planEntry} today={calendar.today} />

      <section
        aria-labelledby="plan-details"
        className="flex flex-col border-t border-foreground/8 pt-6"
      >
        <h2 id="plan-details" className="caps-label text-muted-foreground">
          {t("yourPlan")}
        </h2>
        <div className="flex flex-col gap-1.5 pt-3 pb-5">
          <p className="font-heading text-lg font-bold text-pretty">
            {plan.title}
          </p>
          <p className="text-sm text-pretty text-muted-foreground">
            {plan.summary}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("updated", { date: new Date(updatedAt) })}
          </p>
        </div>
        {plan.highlights.length > 0 ? (
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 pb-5">
            {plan.highlights.map((entry) => (
              <div key={entry.label} className="flex flex-col gap-0.5">
                <dt className="text-xs text-muted-foreground">{entry.label}</dt>
                <dd className="font-heading text-lg font-bold">
                  {entry.value}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}

        {proposals > 0 ? (
          <Fold
            title={t("folds.add")}
            meta={t("folds.addMeta", { count: proposals })}
          >
            {/* Remis à zéro seulement quand le plan est refait (pas après un ajout) */}
            <AddToGetIt
              key={plan.summary}
              kind={kind}
              plan={plan}
              format={format}
              embedded
            />
          </Fold>
        ) : null}

        {plan.sections.length > 0 ? (
          <Fold
            title={t("folds.tips")}
            meta={t("folds.tipsMeta", { count: plan.sections.length })}
          >
            <div className="flex flex-col gap-5">
              {plan.sections.map((section) => (
                <div key={section.title} className="flex flex-col gap-2">
                  <h3 className="font-semibold">{section.title}</h3>
                  <ul className="flex flex-col gap-2">
                    {section.items.map((entry, index) => (
                      <li
                        key={`${entry.title}-${index}`}
                        className="flex flex-col gap-0.5 text-sm"
                      >
                        {entry.title ? (
                          <span className="font-medium">{entry.title}</span>
                        ) : null}
                        {entry.detail ? (
                          <span className="text-muted-foreground">
                            {entry.detail}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Fold>
        ) : null}

        <Fold
          title={t("folds.week")}
          meta={t("folds.weekMeta", { count: plan.schedule.length })}
        >
          <ul className="flex flex-col">
            {plan.schedule.map((session) => (
              <li
                key={session.weekday}
                className="flex flex-col gap-1 border-b border-foreground/8 py-3 last:border-b-0"
              >
                <span className="caps-label text-primary">
                  {format.dateTime(
                    WEEKDAY_DATES.find((day) => day.weekday === session.weekday)
                      ?.date ?? new Date(0),
                    { weekday: "long", timeZone: "UTC" },
                  )}
                </span>
                <span className="font-semibold">{session.title}</span>
                <span className="text-sm text-muted-foreground">
                  {session.items.map((item) => item.name).join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        </Fold>

        <Fold title={t("folds.revise")} meta={t("folds.reviseMeta")}>
          <RevisePlan kind={kind} onCrisis={onCrisis} bare />
        </Fold>
      </section>

      {plan.caution ? (
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <ShieldAlert
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 text-silver"
          />
          {plan.caution}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2 border-t border-foreground/8 pt-6">
        <Button variant="outline" onClick={onRedo}>
          <RefreshCw aria-hidden="true" />
          {t("redo")}
        </Button>
        <DeletePlan kind={kind} />
      </div>
    </article>
  );
}

/** Un volet du plan : titre et résumé, le contenu au toucher. */
function Fold({
  title,
  meta,
  children,
}: {
  title: string;
  meta: string;
  children: ReactNode;
}) {
  return (
    <details className="group border-t border-foreground/8">
      <summary className="flex cursor-pointer list-none items-center gap-3 py-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-semibold">{title}</span>
          <span className="text-xs text-muted-foreground">{meta}</span>
        </span>
        <ChevronRight
          aria-hidden="true"
          className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
        />
      </summary>
      <div className="pb-5">{children}</div>
    </details>
  );
}

/** Ajouter l'objectif, les habitudes et les tâches proposés (au choix). */
function AddToGetIt({
  kind,
  plan,
  format,
  embedded = false,
}: {
  kind: DevelopmentKind;
  plan: DevelopmentPlan;
  format: ReturnType<typeof useFormatter>;
  /** Dans un volet qui porte déjà le titre : sans titre ni trait. */
  embedded?: boolean;
}) {
  const t = useTranslations("Development.plan");
  const tWeekdays = useTranslations("Development.weekdaysShort");
  const [goal, setGoal] = useState(plan.goal !== null);
  const [habits, setHabits] = useState(() =>
    plan.habits.map((habit) => habit.title),
  );
  const [tasks, setTasks] = useState(() =>
    plan.tasks.map((task) => task.title),
  );
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);
  const [goalLimit, setGoalLimit] = useState(false);
  const [pending, startTransition] = useTransition();
  const empty =
    plan.goal === null && plan.habits.length === 0 && plan.tasks.length === 0;
  // Après un ajout, le plan rechargé ne contient plus les éléments ajoutés
  const count =
    Number(goal && plan.goal !== null) +
    plan.habits.filter((habit) => habits.includes(habit.title)).length +
    plan.tasks.filter((task) => tasks.includes(task.title)).length;

  if (empty && !done) return null;

  const toggle = (list: string[], title: string) =>
    list.includes(title)
      ? list.filter((item) => item !== title)
      : [...list, title];

  function add() {
    setFailed(false);
    setGoalLimit(false);
    startTransition(async () => {
      const ok = await applyPlanAction(kind, {
        goal: goal && plan.goal !== null,
        habits: plan.habits.filter((habit) => habits.includes(habit.title)),
        tasks: plan.tasks.filter((task) => tasks.includes(task.title)),
      });
      if (ok === "goalLimit") setGoalLimit(true);
      else if (ok) setDone(true);
      else setFailed(true);
    });
  }

  const row = "flex items-start gap-3 py-2.5 text-sm";

  return (
    <section
      className={cn(
        "flex flex-col gap-3",
        !embedded && "border-t border-foreground/8 pt-6",
      )}
    >
      <div className="flex flex-col gap-1">
        <h3
          className={cn(
            "font-heading text-lg font-bold",
            embedded && "sr-only",
          )}
        >
          {t("addTitle")}
        </h3>
        <p className="text-sm text-muted-foreground">{t("addDescription")}</p>
      </div>
      {done ? (
        <p
          role="status"
          className="flex items-center gap-2 text-sm text-primary"
        >
          <CircleCheck aria-hidden="true" className="size-4" />
          {t("added")}
        </p>
      ) : null}
      {empty ? null : (
        <>
          <ul className="flex flex-col divide-y divide-foreground/8">
            {plan.goal ? (
              <li>
                <label className={row}>
                  <Checkbox
                    checked={goal}
                    onCheckedChange={(value) => setGoal(value === true)}
                    className="mt-0.5"
                  />
                  <span className="flex flex-col">
                    <span className="font-medium">{plan.goal.title}</span>
                    <span className="text-muted-foreground">
                      {t("goalMeta", { days: plan.goal.targetInDays })}
                    </span>
                  </span>
                </label>
              </li>
            ) : null}
            {plan.habits.map((habit) => (
              <li key={habit.title}>
                <label className={row}>
                  <Checkbox
                    checked={habits.includes(habit.title)}
                    onCheckedChange={() =>
                      setHabits((current) => toggle(current, habit.title))
                    }
                    className="mt-0.5"
                  />
                  <span className="flex flex-col">
                    <span className="font-medium">{habit.title}</span>
                    <span className="text-muted-foreground">
                      {t("habitMeta", {
                        days:
                          habit.weekdays.length === 7
                            ? t("everyDay")
                            : format.list(
                                habit.weekdays.map((day) =>
                                  tWeekdays(String(day) as "1"),
                                ),
                              ),
                      })}
                    </span>
                  </span>
                </label>
              </li>
            ))}
            {plan.tasks.map((task) => (
              <li key={task.title}>
                <label className={row}>
                  <Checkbox
                    checked={tasks.includes(task.title)}
                    onCheckedChange={() =>
                      setTasks((current) => toggle(current, task.title))
                    }
                    className="mt-0.5"
                  />
                  <span className="flex flex-col">
                    <span className="font-medium">{task.title}</span>
                    <span className="text-muted-foreground">
                      {t("taskMeta", { days: task.dueInDays })}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          {failed ? (
            <p role="alert" className="text-sm text-destructive">
              {t("addFailed")}
            </p>
          ) : null}
          {goalLimit ? (
            <p role="alert" className="text-sm text-destructive">
              {t("goalLimit")}
            </p>
          ) : null}
          <Button
            className="w-fit"
            disabled={pending || count === 0}
            onClick={add}
          >
            {pending ? (
              <LoaderCircle aria-hidden="true" className="animate-spin" />
            ) : (
              <Plus aria-hidden="true" />
            )}
            {t("addAction", { count })}
          </Button>
        </>
      )}
    </section>
  );
}

function DeletePlan({ kind }: { kind: DevelopmentKind }) {
  const t = useTranslations("Development.plan");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Button
        variant="ghost"
        className="text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <Trash2 aria-hidden="true" />
        {t("delete")}
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  if (await deletePlanAction(kind)) setOpen(false);
                })
              }
            >
              {pending ? (
                <LoaderCircle aria-hidden="true" className="animate-spin" />
              ) : null}
              {t("deleteConfirm")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
