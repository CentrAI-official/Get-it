"use client";

import { LoaderCircle, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useActionState, useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { toDbDate } from "@/lib/dates";
import {
  contributeToGoalAction,
  deleteGoalAction,
  saveGoalAction,
  type FormResult,
} from "../budget-actions";
import { amountField, formatMoney } from "../format";
import {
  GOAL_NAME_MAX,
  type BudgetGoalRow,
  type GoalField,
  type goalProgress,
} from "../goals";
import type { BudgetError } from "../rules";
import { AmountField } from "./budget-dialogs";
import { useBudget } from "./budget-context";

type Progress = ReturnType<typeof goalProgress>;

function useErrorText() {
  const t = useTranslations("Budget.errors");
  return (key: BudgetError | undefined | null) => (key ? t(key) : null);
}

/** Un objectif : sa barre, ce qui manque et combien mettre de côté par mois. */
export function GoalRow({
  goal,
  progress,
}: {
  goal: BudgetGoalRow;
  progress: Progress;
}) {
  const t = useTranslations("Budget.goals");
  const format = useFormatter();
  const { currency } = useBudget();
  const money = (cents: number) => formatMoney(format, cents, currency);
  const [open, setOpen] = useState(false);
  return (
    <li className="border-b border-foreground/8 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full flex-col gap-2 py-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="flex items-baseline justify-between gap-3">
          <span className="truncate text-sm font-semibold">{goal.name}</span>
          <span className="shrink-0 font-display text-2xl leading-none tracking-wide tabular-nums">
            {progress.percent}&nbsp;%
          </span>
        </span>
        <span
          aria-hidden="true"
          className="h-2 overflow-hidden rounded-full bg-foreground/8"
        >
          <span
            style={{ width: `${Math.max(progress.percent, 1)}%` }}
            className="block h-full rounded-full bg-primary"
          />
        </span>
        <span className="flex items-baseline justify-between gap-3 text-xs text-muted-foreground">
          <span className="tabular-nums">
            {t("saved", {
              saved: money(progress.savedCents),
              target: money(goal.targetCents),
            })}
          </span>
          <span className="shrink-0">
            {progress.done
              ? t("done")
              : progress.late
                ? t("late")
                : progress.monthlyCents
                  ? t("perMonth", { amount: money(progress.monthlyCents) })
                  : null}
          </span>
        </span>
      </button>
      {open ? (
        <GoalDialog
          goal={goal}
          progress={progress}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </li>
  );
}

/** Ajouter un objectif ; le fonds d'urgence est proposé d'avance. */
export function GoalAddButton({
  emergency,
}: {
  emergency: { cents: number; hint: string } | null;
}) {
  const t = useTranslations("Budget.goals");
  const locale = useLocale();
  const [open, setOpen] = useState<null | {
    name: string;
    target: string;
    emergency: boolean;
  }>(null);
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        className="h-11"
        onClick={() => setOpen({ name: "", target: "", emergency: false })}
      >
        <Plus aria-hidden="true" />
        {t("add")}
      </Button>
      {emergency ? (
        <Button
          variant="outline"
          className="h-11"
          title={emergency.hint}
          onClick={() =>
            setOpen({
              name: t("emergencyName"),
              target: amountField(emergency.cents, locale),
              emergency: true,
            })
          }
        >
          <ShieldCheck aria-hidden="true" />
          {t("emergency")}
        </Button>
      ) : null}
      {open ? (
        <GoalDialog
          goal={null}
          progress={null}
          initial={open}
          hint={open.emergency && emergency ? emergency.hint : null}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </div>
  );
}

function GoalDialog({
  goal,
  progress,
  initial,
  hint,
  onClose,
}: {
  goal: BudgetGoalRow | null;
  progress: Progress | null;
  initial?: { name: string; target: string; emergency: boolean };
  hint?: string | null;
  onClose: () => void;
}) {
  const t = useTranslations("Budget.goals");
  const tForm = useTranslations("Budget.form");
  const locale = useLocale();
  const id = useId();
  const errorText = useErrorText();
  const { today } = useBudget();
  const format = useFormatter();
  const [name, setName] = useState(goal?.name ?? initial?.name ?? "");
  const [target, setTarget] = useState(
    goal ? amountField(goal.targetCents, locale) : (initial?.target ?? ""),
  );
  const [targetOn, setTargetOn] = useState(goal?.targetOn ?? "");
  const [starting, setStarting] = useState(
    goal?.startingCents ? amountField(goal.startingCents, locale) : "",
  );
  const [contribution, setContribution] = useState(
    progress?.monthlyCents ? amountField(progress.monthlyCents, locale) : "",
  );
  const [contributeError, setContributeError] = useState<BudgetError | null>(
    null,
  );
  const [busy, startTransition] = useTransition();
  const [state, formAction, pending] = useActionState<
    FormResult<GoalField>,
    FormData
  >(
    async (previous, formData) => {
      const result = await saveGoalAction(goal?.id ?? null, previous, formData);
      if (result.status === "saved") onClose();
      return result;
    },
    { status: "idle" },
  );
  const fieldError = (field: GoalField) =>
    errorText(state.fieldErrors?.[field]);

  return (
    <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{goal ? goal.name : t("add")}</DialogTitle>
          <DialogDescription>{hint ?? t("formText")}</DialogDescription>
        </DialogHeader>

        {goal && progress && !progress.done ? (
          <form
            className="flex flex-col gap-3 border-b border-foreground/8 pb-5"
            onSubmit={(event) => {
              event.preventDefault();
              setContributeError(null);
              startTransition(async () => {
                const result = await contributeToGoalAction({
                  goalId: goal.id,
                  amount: contribution,
                  date: today,
                });
                if (result.ok) onClose();
                else setContributeError(result.error);
              });
            }}
          >
            <AmountField
              id={`${id}-contribution`}
              name="contribution"
              label={t("contribute")}
              value={contribution}
              onChange={setContribution}
              error={errorText(contributeError)}
            />
            <p className="text-xs text-pretty text-muted-foreground">
              {t("contributeHint")}
            </p>
            <Button type="submit" className="h-11 w-fit" disabled={busy}>
              {busy ? (
                <LoaderCircle aria-hidden="true" className="animate-spin" />
              ) : null}
              {t("contributeButton")}
            </Button>
          </form>
        ) : null}

        <form action={formAction} noValidate className="flex flex-col gap-5">
          {/* Le fonds d'urgence que suit le plan d'argent */}
          {!goal && initial?.emergency ? (
            <input type="hidden" name="emergency" value="1" />
          ) : null}
          <Field data-invalid={fieldError("name") ? true : undefined}>
            <FieldLabel htmlFor={`${id}-name`}>{t("name")}</FieldLabel>
            <Input
              id={`${id}-name`}
              name="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={GOAL_NAME_MAX}
              autoComplete="off"
              placeholder={t("namePlaceholder")}
              className="h-11"
            />
            {fieldError("name") ? (
              <FieldError>{fieldError("name")}</FieldError>
            ) : null}
          </Field>
          <AmountField
            id={id}
            name="target"
            label={t("target")}
            value={target}
            onChange={setTarget}
            error={fieldError("target")}
          />
          <Field data-invalid={fieldError("targetOn") ? true : undefined}>
            <FieldLabel htmlFor={`${id}-date`}>
              {t("targetOn")}{" "}
              <span className="font-normal text-muted-foreground">
                {tForm("optional")}
              </span>
            </FieldLabel>
            <Input
              id={`${id}-date`}
              name="targetOn"
              type="date"
              min={today}
              value={targetOn}
              onChange={(event) => setTargetOn(event.target.value)}
              className="h-11 w-auto"
            />
          </Field>
          <Field data-invalid={fieldError("starting") ? true : undefined}>
            <FieldLabel htmlFor={`${id}-starting`}>
              {t("starting")}{" "}
              <span className="font-normal text-muted-foreground">
                {tForm("optional")}
              </span>
            </FieldLabel>
            <Input
              id={`${id}-starting`}
              name="starting"
              value={starting}
              onChange={(event) => setStarting(event.target.value)}
              inputMode="decimal"
              autoComplete="off"
              placeholder="0"
              className="h-11"
            />
            {fieldError("starting") ? (
              <FieldError>{fieldError("starting")}</FieldError>
            ) : null}
          </Field>
          {goal?.targetOn ? (
            <p className="text-xs text-muted-foreground">
              {t("dateReminder", {
                date: format.dateTime(toDbDate(goal.targetOn), {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  timeZone: "UTC",
                }),
              })}
            </p>
          ) : null}
          {state.error ? (
            <p role="alert" className="text-sm text-destructive">
              {errorText(state.error)}
            </p>
          ) : null}
          <DialogFooter>
            {goal ? (
              <Button
                type="button"
                variant="ghost"
                className="text-muted-foreground sm:mr-auto"
                disabled={busy}
                onClick={() =>
                  startTransition(async () => {
                    const result = await deleteGoalAction(goal.id);
                    if (result.ok) onClose();
                  })
                }
              >
                <Trash2 aria-hidden="true" />
                {t("delete")}
              </Button>
            ) : null}
            <Button type="submit" className="h-11" disabled={pending}>
              {pending ? (
                <LoaderCircle aria-hidden="true" className="animate-spin" />
              ) : null}
              {goal ? t("save") : t("create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
