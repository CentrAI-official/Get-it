"use client";

import { useLocale, useTranslations } from "next-intl";
import { useId } from "react";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  COUNTRIES,
  PROVINCES,
  QC_REGIONS,
  SEXES,
  type ProfileDetailError,
  type ProfileDetailsDraft,
} from "../details";

const select =
  "h-10 w-full rounded-lg border border-input bg-input/30 px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 aria-invalid:border-destructive [&>option]:bg-popover";

type ProfileDetailsFieldsProps = {
  value: ProfileDetailsDraft;
  onChange: (patch: Partial<ProfileDetailsDraft>) => void;
  errors?: Partial<Record<keyof ProfileDetailsDraft, ProfileDetailError>>;
  /** Aujourd'hui, dans le fuseau de la personne (borne de la date de naissance). */
  today: string;
};

/**
 * Date de naissance, sexe à la naissance, pays, province ou État, et région au
 * Québec. Champs contrôlés : la création du compte, l'écran unique des comptes
 * existants et les Réglages les partagent.
 */
export function ProfileDetailsFields({
  value,
  onChange,
  errors = {},
  today,
}: ProfileDetailsFieldsProps) {
  const t = useTranslations("Details");
  const tPlaces = useTranslations("Places");
  const tRegions = useTranslations("Marketplace.regions");
  const locale = useLocale();
  const id = useId();
  const collator = new Intl.Collator(locale);
  const provinces = value.country
    ? [...PROVINCES[value.country]].sort((a, b) =>
        collator.compare(tPlaces(`provinces.${a}`), tPlaces(`provinces.${b}`)),
      )
    : [];
  const regions = [...QC_REGIONS].sort((a, b) =>
    collator.compare(tRegions(a), tRegions(b)),
  );
  const error = (field: keyof ProfileDetailsDraft) => {
    const key = errors[field];
    return key ? (
      <FieldError id={`${id}-${field}-error`}>{t(`errors.${key}`)}</FieldError>
    ) : null;
  };
  const describedBy = (field: keyof ProfileDetailsDraft) =>
    errors[field] ? `${id}-${field}-error` : undefined;

  return (
    <FieldGroup>
      <Field data-invalid={errors.birthDate ? true : undefined}>
        <FieldLabel htmlFor={`${id}-birth`}>{t("birthDate")}</FieldLabel>
        <Input
          id={`${id}-birth`}
          type="date"
          min="1900-01-01"
          max={today}
          value={value.birthDate}
          onChange={(event) => onChange({ birthDate: event.target.value })}
          aria-invalid={errors.birthDate ? true : undefined}
          aria-describedby={describedBy("birthDate") ?? `${id}-birth-hint`}
          autoComplete="bday"
          className="h-10"
        />
        {error("birthDate") ?? (
          <FieldDescription id={`${id}-birth-hint`}>
            {t("birthDateHint")}
          </FieldDescription>
        )}
      </Field>

      <FieldSet data-invalid={errors.sex ? true : undefined}>
        <FieldLegend variant="label">{t("sex")}</FieldLegend>
        <RadioGroup
          value={value.sex ?? ""}
          onValueChange={(next) =>
            onChange({ sex: SEXES.find((option) => option === next) ?? null })
          }
          aria-describedby={describedBy("sex")}
          className="grid grid-cols-2 gap-2"
        >
          {SEXES.map((sex) => (
            <FieldLabel key={sex} htmlFor={`${id}-sex-${sex}`}>
              <Field orientation="horizontal">
                <RadioGroupItem value={sex} id={`${id}-sex-${sex}`} />
                <FieldTitle>{t(`sexes.${sex}`)}</FieldTitle>
              </Field>
            </FieldLabel>
          ))}
        </RadioGroup>
        {error("sex") ?? <FieldDescription>{t("sexHint")}</FieldDescription>}
      </FieldSet>

      <FieldSet data-invalid={errors.country ? true : undefined}>
        <FieldLegend variant="label">{t("country")}</FieldLegend>
        <RadioGroup
          value={value.country ?? ""}
          onValueChange={(next) => {
            const country = COUNTRIES.find((option) => option === next) ?? null;
            // Un autre pays : la province et la région ne valent plus
            if (country !== value.country) {
              onChange({ country, province: null, qcRegion: null });
            }
          }}
          aria-describedby={describedBy("country")}
          className="grid grid-cols-2 gap-2"
        >
          {COUNTRIES.map((country) => (
            <FieldLabel key={country} htmlFor={`${id}-country-${country}`}>
              <Field orientation="horizontal">
                <RadioGroupItem
                  value={country}
                  id={`${id}-country-${country}`}
                />
                <FieldTitle>{tPlaces(`countries.${country}`)}</FieldTitle>
              </Field>
            </FieldLabel>
          ))}
        </RadioGroup>
        {error("country")}
      </FieldSet>

      {value.country ? (
        <Field data-invalid={errors.province ? true : undefined}>
          <FieldLabel htmlFor={`${id}-province`}>
            {t(`province.${value.country}`)}
          </FieldLabel>
          <select
            id={`${id}-province`}
            value={value.province ?? ""}
            onChange={(event) => {
              const province =
                provinces.find((code) => code === event.target.value) ?? null;
              onChange({
                province,
                qcRegion: province === "QC" ? value.qcRegion : null,
              });
            }}
            aria-invalid={errors.province ? true : undefined}
            aria-describedby={describedBy("province")}
            className={select}
          >
            <option value="" disabled>
              {t("provincePlaceholder")}
            </option>
            {provinces.map((code) => (
              <option key={code} value={code}>
                {tPlaces(`provinces.${code}`)}
              </option>
            ))}
          </select>
          {error("province")}
        </Field>
      ) : null}

      {value.province === "QC" ? (
        <Field data-invalid={errors.qcRegion ? true : undefined}>
          <FieldLabel htmlFor={`${id}-region`}>{t("qcRegion")}</FieldLabel>
          <select
            id={`${id}-region`}
            value={value.qcRegion ?? ""}
            onChange={(event) =>
              onChange({
                qcRegion:
                  QC_REGIONS.find((region) => region === event.target.value) ??
                  null,
              })
            }
            aria-invalid={errors.qcRegion ? true : undefined}
            aria-describedby={describedBy("qcRegion") ?? `${id}-region-hint`}
            className={select}
          >
            <option value="" disabled>
              {t("provincePlaceholder")}
            </option>
            {regions.map((region) => (
              <option key={region} value={region}>
                {tRegions(region)}
              </option>
            ))}
          </select>
          {error("qcRegion") ?? (
            <FieldDescription id={`${id}-region-hint`}>
              {t("qcRegionHint")}
            </FieldDescription>
          )}
        </Field>
      ) : null}

      <p className="text-sm text-muted-foreground">{t("privacy")}</p>
    </FieldGroup>
  );
}
