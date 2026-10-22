"use client";

import { CircleAlert, LoaderCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
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
import { Textarea } from "@/components/ui/textarea";
import { PILLARS, pillarIcons, type Pillar } from "@/config/pillars";
import { Link } from "@/i18n/navigation";
import {
  GOAL_DESCRIPTION_MAX_LENGTH,
  GOAL_TITLE_MAX_LENGTH,
  type GoalFormState,
} from "../schemas";

type GoalFormProps = {
  action: (state: GoalFormState, formData: FormData) => Promise<GoalFormState>;
  defaults?: {
    title: string;
    description: string;
    pillar: Pillar;
    targetDate: string;
  };
  submitLabel: string;
  pendingLabel: string;
  cancelHref: string;
};

/** Création ou modification d'un objectif. */
export function GoalForm({
  action,
  defaults,
  submitLabel,
  pendingLabel,
  cancelHref,
}: GoalFormProps) {
  const t = useTranslations("Goals");
  const tPillars = useTranslations("Pillars");
  const locale = useLocale();
  // Id uniques : Next garde la page précédente cachée dans le DOM
  const id = useId();
  const [state, formAction, pending] = useActionState(action, {
    status: "idle",
  });
  // Contrôlé : le formulaire est réinitialisé après chaque envoi
  const [pillar, setPillar] = useState<Pillar | "">(defaults?.pillar ?? "");
  const errors = state.fieldErrors ?? {};
  const value = (field: "title" | "description" | "targetDate") =>
    state.values?.[field] ?? defaults?.[field] ?? "";

  return (
    <form
      action={formAction}
      noValidate
      className="flex max-w-2xl flex-col gap-6"
    >
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="pillar" value={pillar} />
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
            defaultValue={value("title")}
            placeholder={t("form.titlePlaceholder")}
            maxLength={GOAL_TITLE_MAX_LENGTH}
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

        <Field data-invalid={errors.description ? true : undefined}>
          <FieldLabel htmlFor={`${id}-description`}>
            {t("form.descriptionLabel")}
            <span className="font-normal text-muted-foreground">
              ({t("form.optional")})
            </span>
          </FieldLabel>
          <Textarea
            id={`${id}-description`}
            name="description"
            defaultValue={value("description")}
            placeholder={t("form.descriptionPlaceholder")}
            maxLength={GOAL_DESCRIPTION_MAX_LENGTH}
            rows={3}
            aria-invalid={errors.description ? true : undefined}
            aria-describedby={
              errors.description ? `${id}-description-error` : undefined
            }
          />
          {errors.description ? (
            <FieldError id={`${id}-description-error`}>
              {t(`errors.${errors.description}`)}
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

        <Field data-invalid={errors.targetDate ? true : undefined}>
          <FieldLabel htmlFor={`${id}-target-date`}>
            {t("form.targetDateLabel")}
            <span className="font-normal text-muted-foreground">
              ({t("form.optional")})
            </span>
          </FieldLabel>
          <Input
            id={`${id}-target-date`}
            name="targetDate"
            type="date"
            defaultValue={value("targetDate")}
            aria-invalid={errors.targetDate ? true : undefined}
            aria-describedby={
              errors.targetDate ? `${id}-target-date-error` : undefined
            }
            className="h-10 sm:w-52"
          />
          {errors.targetDate ? (
            <FieldError id={`${id}-target-date-error`}>
              {t(`errors.${errors.targetDate}`)}
            </FieldError>
          ) : null}
        </Field>
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
