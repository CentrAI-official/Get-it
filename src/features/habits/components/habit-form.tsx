"use client";

import { CircleAlert, LoaderCircle } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useActionState, useId, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { PILLARS, pillarIcons, type Pillar } from "@/config/pillars";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import {
  HABIT_TITLE_MAX_LENGTH,
  WEEKDAYS,
  WORKWEEK,
  type HabitFormState,
} from "../schemas";
import { WEEKDAY_DATES } from "../weekdays";

const PRESETS = {
  daily: WEEKDAYS,
  workweek: WORKWEEK,
  weekend: [6, 7],
} as const;

type HabitFormProps = {
  action: (
    state: HabitFormState,
    formData: FormData,
  ) => Promise<HabitFormState>;
  /** Objectifs en cours, proposés pour le lien facultatif. */
  goals: { id: string; title: string }[];
  defaults?: {
    title: string;
    pillar: Pillar;
    weekdays: number[];
    goalId: string;
  };
  submitLabel: string;
  pendingLabel: string;
  cancelHref: string;
};

/** Création ou modification d'une habitude. */
export function HabitForm({
  action,
  goals,
  defaults,
  submitLabel,
  pendingLabel,
  cancelHref,
}: HabitFormProps) {
  const t = useTranslations("Habits");
  const tPillars = useTranslations("Pillars");
  const format = useFormatter();
  const locale = useLocale();
  // Id uniques : Next garde la page précédente cachée dans le DOM
  const id = useId();
  const [state, formAction, pending] = useActionState(action, {
    status: "idle",
  });
  // Contrôlés : le formulaire est réinitialisé après chaque envoi
  const [pillar, setPillar] = useState<Pillar | "">(defaults?.pillar ?? "");
  const [weekdays, setWeekdays] = useState<number[]>(
    defaults?.weekdays ?? [...WEEKDAYS],
  );
  const errors = state.fieldErrors ?? {};

  function toggleWeekday(weekday: number) {
    setWeekdays((current) =>
      current.includes(weekday)
        ? current.filter((day) => day !== weekday)
        : [...current, weekday].sort((a, b) => a - b),
    );
  }

  return (
    <form
      action={formAction}
      noValidate
      className="flex max-w-2xl flex-col gap-6 rounded-3xl glass p-5 sm:p-6"
    >
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="pillar" value={pillar} />
      <input type="hidden" name="weekdays" value={weekdays.join(",")} />
      {state.error ? (
        <Alert variant="destructive">
          <CircleAlert aria-hidden="true" />
          <AlertDescription>{t(`errors.${state.error}`)}</AlertDescription>
        </Alert>
      ) : null}

      <FieldGroup>
        <Field data-invalid={errors.title ? true : undefined}>
          <FieldLabel htmlFor={`${id}-title`}>
            {t("form.titleLabel")}
          </FieldLabel>
          <Input
            id={`${id}-title`}
            name="title"
            defaultValue={state.values?.title ?? defaults?.title ?? ""}
            placeholder={t("form.titlePlaceholder")}
            maxLength={HABIT_TITLE_MAX_LENGTH}
            required
            aria-invalid={errors.title ? true : undefined}
            aria-describedby={errors.title ? `${id}-title-error` : undefined}
            className="h-10"
          />
          {errors.title ? (
            <FieldError id={`${id}-title-error`}>
              {t(`errors.${errors.title}`)}
            </FieldError>
          ) : null}
        </Field>

        <FieldSet data-invalid={errors.pillar ? true : undefined}>
          <FieldLegend variant="label">{t("form.pillarLabel")}</FieldLegend>
          <RadioGroup
            value={pillar}
            onValueChange={(next) =>
              setPillar(PILLARS.find((item) => item === next) ?? "")
            }
            aria-invalid={errors.pillar ? true : undefined}
            aria-describedby={errors.pillar ? `${id}-pillar-error` : undefined}
            className="grid grid-cols-2 gap-2 sm:grid-cols-4"
          >
            {PILLARS.map((item) => {
              const Icon = pillarIcons[item];
              return (
                <FieldLabel key={item} htmlFor={`${id}-pillar-${item}`}>
                  <Field orientation="horizontal">
                    <RadioGroupItem value={item} id={`${id}-pillar-${item}`} />
                    <FieldTitle>
                      <Icon aria-hidden="true" className="size-4 text-silver" />
                      {tPillars(`${item}.name`)}
                    </FieldTitle>
                  </Field>
                </FieldLabel>
              );
            })}
          </RadioGroup>
          {errors.pillar ? (
            <FieldError id={`${id}-pillar-error`}>
              {t(`errors.${errors.pillar}`)}
            </FieldError>
          ) : null}
        </FieldSet>

        <FieldSet data-invalid={errors.weekdays ? true : undefined}>
          <FieldLegend variant="label">{t("form.weekdaysLabel")}</FieldLegend>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(PRESETS) as (keyof typeof PRESETS)[]).map(
              (preset) => {
                const days = PRESETS[preset];
                const active = weekdays.join() === days.join();
                return (
                  <Button
                    key={preset}
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-pressed={active}
                    onClick={() => setWeekdays([...days])}
                    className="aria-pressed:border-primary aria-pressed:bg-primary/10 dark:aria-pressed:border-primary dark:aria-pressed:bg-primary/10"
                  >
                    {t(`form.presets.${preset}`)}
                  </Button>
                );
              },
            )}
          </div>
          <div
            role="group"
            aria-label={t("form.weekdaysLabel")}
            aria-describedby={
              errors.weekdays ? `${id}-weekdays-error` : undefined
            }
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
          {errors.weekdays ? (
            <FieldError id={`${id}-weekdays-error`}>
              {t(`errors.${errors.weekdays}`)}
            </FieldError>
          ) : null}
        </FieldSet>

        {goals.length > 0 ? (
          <Field>
            <FieldLabel htmlFor={`${id}-goal`}>
              {t("form.goalLabel")}
              <span className="font-normal text-muted-foreground">
                ({t("form.optional")})
              </span>
            </FieldLabel>
            <select
              id={`${id}-goal`}
              name="goalId"
              defaultValue={state.values?.goalId ?? defaults?.goalId ?? ""}
              className="h-10 w-full rounded-lg border border-input bg-input/30 px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:max-w-sm"
            >
              <option value="">{t("form.noGoal")}</option>
              {goals.map((goal) => (
                <option key={goal.id} value={goal.id}>
                  {goal.title}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
      </FieldGroup>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          size="lg"
          disabled={pending}
          className="h-10 px-5"
        >
          {pending ? (
            <>
              <LoaderCircle aria-hidden="true" className="animate-spin" />
              {pendingLabel}
            </>
          ) : (
            submitLabel
          )}
        </Button>
        <Button asChild variant="ghost" size="lg" className="h-10">
          <Link href={cancelHref}>{t("form.cancel")}</Link>
        </Button>
      </div>
    </form>
  );
}
