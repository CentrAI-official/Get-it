"use client";

import { useTranslations } from "next-intl";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { DAILY_MINUTES_OPTIONS } from "../schemas";
import type { StepProps } from "./step-props";

export function TimeStep({ draft, update }: StepProps) {
  const t = useTranslations("Onboarding.time");

  return (
    <RadioGroup
      aria-label={t("title")}
      value={draft.dailyMinutes?.toString() ?? ""}
      onValueChange={(value) =>
        update({
          dailyMinutes:
            DAILY_MINUTES_OPTIONS.find(
              (option) => option.minutes.toString() === value,
            )?.minutes ?? null,
        })
      }
      className="grid gap-3 sm:grid-cols-2"
    >
      {DAILY_MINUTES_OPTIONS.map(({ minutes, key }) => (
        <FieldLabel key={key} htmlFor={`time-${key}`}>
          <Field orientation="horizontal">
            <RadioGroupItem value={minutes.toString()} id={`time-${key}`} />
            <FieldContent>
              <FieldTitle>{t(`options.${key}`)}</FieldTitle>
              <FieldDescription>{t(`hints.${key}`)}</FieldDescription>
            </FieldContent>
          </Field>
        </FieldLabel>
      ))}
    </RadioGroup>
  );
}
