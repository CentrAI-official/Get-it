"use client";

import { useTranslations } from "next-intl";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { DISPLAY_NAME_MAX_LENGTH, OCCUPATIONS } from "../schemas";
import type { StepProps } from "./step-props";

export function AboutStep({ draft, update }: StepProps) {
  const t = useTranslations("Onboarding.about");

  return (
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor="onboarding-name">{t("nameLabel")}</FieldLabel>
        <Input
          id="onboarding-name"
          value={draft.displayName}
          onChange={(event) => update({ displayName: event.target.value })}
          placeholder={t("namePlaceholder")}
          autoComplete="given-name"
          maxLength={DISPLAY_NAME_MAX_LENGTH}
          required
          className="h-10"
        />
      </Field>
      <FieldSet>
        <FieldLegend variant="label">
          {t("occupationLabel")}{" "}
          <span className="font-normal text-muted-foreground">
            ({t("optional")})
          </span>
        </FieldLegend>
        <RadioGroup
          value={draft.occupation ?? ""}
          onValueChange={(value) =>
            update({
              occupation:
                OCCUPATIONS.find((option) => option === value) ?? null,
            })
          }
          className="grid grid-cols-2 gap-2 sm:grid-cols-3"
        >
          {OCCUPATIONS.map((occupation) => (
            <FieldLabel key={occupation} htmlFor={`occupation-${occupation}`}>
              <Field orientation="horizontal">
                <RadioGroupItem
                  value={occupation}
                  id={`occupation-${occupation}`}
                />
                <FieldTitle>{t(`occupations.${occupation}`)}</FieldTitle>
              </Field>
            </FieldLabel>
          ))}
        </RadioGroup>
      </FieldSet>
    </FieldGroup>
  );
}
