"use client";

import {
  Briefcase,
  CircleCheck,
  LoaderCircle,
  Plus,
  RefreshCw,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
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
import { Link } from "@/i18n/navigation";
import { applyPlanAction, deletePlanAction } from "../actions";
import type { CalendarData } from "../calendar";
import type { DevelopmentPlan } from "../plan";
import type { DevelopmentKind } from "../questionnaires";
import { CalendarView } from "./calendar-view";

type PlanViewProps = {
  kind: DevelopmentKind;
  plan: DevelopmentPlan;
  updatedAt: string;
  /** Calendrier de ce plan (mois en cours). */
  calendar: CalendarData;
  /** Plan financier d'une personne qui a ou veut une entreprise. */
  suggestBusiness: boolean;
  onRedo: () => void;
};

/** Un plan de « Mon développement » et ce qu'on peut en ajouter à Get iT. */
export function PlanView({
  kind,
  plan,
  updatedAt,
  calendar,
  suggestBusiness,
  onRedo,
}: PlanViewProps) {
  const t = useTranslations("Development.plan");
  const tCalendar = useTranslations("Development.calendar");
  const format = useFormatter();

  return (
    <article className="flex max-w-2xl flex-col gap-8">
      {/* En haut : le calendrier de ce plan seulement (séance du jour choisi) */}
      <section aria-labelledby="plan-calendar" className="flex flex-col gap-2">
        <h2 id="plan-calendar" className="sr-only">
          {tCalendar("planTitle")}
        </h2>
        <CalendarView initial={calendar} scope={kind} />
      </section>

      <header className="flex flex-col gap-2 border-t border-white/8 pt-6">
        <p className="text-sm text-muted-foreground">
          {t("updated", { date: new Date(updatedAt) })}
        </p>
        <h2 className="font-heading text-2xl font-bold tracking-tight text-pretty">
          {plan.title}
        </h2>
        <p className="text-muted-foreground">{plan.summary}</p>
      </header>

      {plan.highlights.length > 0 ? (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
          {plan.highlights.map((entry) => (
            <div key={entry.label} className="flex flex-col gap-0.5">
              <dt className="text-xs text-muted-foreground">{entry.label}</dt>
              <dd className="font-heading text-lg font-bold">{entry.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {plan.sections.map((section) => (
        <section
          key={section.title}
          className="flex flex-col gap-3 border-t border-white/8 pt-6"
        >
          <h3 className="font-heading text-lg font-bold">{section.title}</h3>
          <ul className="flex flex-col gap-3">
            {section.items.map((entry, index) => (
              <li
                key={`${entry.title}-${index}`}
                className="flex flex-col gap-0.5"
              >
                {entry.title ? (
                  <p className="font-medium">{entry.title}</p>
                ) : null}
                {entry.detail ? (
                  <p className="text-sm text-muted-foreground">
                    {entry.detail}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ))}

      {plan.caution ? (
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <ShieldAlert
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 text-silver"
          />
          {plan.caution}
        </p>
      ) : null}

      {/* Remis à zéro seulement quand le plan est refait (pas après un ajout) */}
      <AddToGetIt key={plan.summary} kind={kind} plan={plan} format={format} />

      {suggestBusiness ? (
        <Link
          href="/services/business"
          className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/10 p-4 text-sm font-medium outline-none hover:bg-primary/15 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Briefcase
            aria-hidden="true"
            className="size-5 shrink-0 text-primary"
          />
          {t("businessCta")}
        </Link>
      ) : null}

      <div className="flex flex-wrap gap-2 border-t border-white/8 pt-6">
        <Button variant="outline" onClick={onRedo}>
          <RefreshCw aria-hidden="true" />
          {t("redo")}
        </Button>
        <DeletePlan kind={kind} />
      </div>
    </article>
  );
}

/** Ajouter l'objectif, les habitudes et les tâches proposés (au choix). */
function AddToGetIt({
  kind,
  plan,
  format,
}: {
  kind: DevelopmentKind;
  plan: DevelopmentPlan;
  format: ReturnType<typeof useFormatter>;
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
    startTransition(async () => {
      const ok = await applyPlanAction(kind, {
        goal: goal && plan.goal !== null,
        habits: plan.habits.filter((habit) => habits.includes(habit.title)),
        tasks: plan.tasks.filter((task) => tasks.includes(task.title)),
      });
      if (ok) setDone(true);
      else setFailed(true);
    });
  }

  const row = "flex items-start gap-3 py-2.5 text-sm";

  return (
    <section className="flex flex-col gap-3 border-t border-white/8 pt-6">
      <div className="flex flex-col gap-1">
        <h3 className="font-heading text-lg font-bold">{t("addTitle")}</h3>
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
          <ul className="flex flex-col divide-y divide-white/8">
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
