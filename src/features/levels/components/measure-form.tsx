"use client";

import { CircleAlert, LoaderCircle, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { useId, useState, useTransition, type ReactNode } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { Country, Sex } from "@/features/profile/details";
import { REACH_SIDES } from "@/features/ranked/questionnaire";
import type { LevelError, RecordResult } from "@/server/levels/service";
import { recordMeasurementsAction } from "../actions";
import {
  factorPillar,
  fieldsOf,
  measureAnswersSchema,
  type LevelFactor,
  type MeasureField,
} from "../factors";

/** Unité affichée à droite de chaque champ numérique. */
const UNITS: Partial<
  Record<MeasureField, "m" | "cm" | "kg" | "money" | "monthly" | "weekly">
> = {
  runMeters: "m",
  reachCm: "cm",
  jumpCm: "cm",
  weightKg: "kg",
  benchKg: "kg",
  netIncome: "money",
  assets: "money",
  debts: "money",
  monthlyExpenses: "monthly",
  weeklyHours: "weekly",
};

/**
 * Formulaire de mesures : toutes celles d'un pilier (première évaluation) ou
 * une seule (mesure refaite). Le pays (devise) et le sexe (pompes sur les
 * genoux pour les femmes, normes de la SCPE) viennent du compte.
 */
export function MeasureForm({
  factors,
  consentRequired,
  country,
  sex,
  onSaved,
}: {
  factors: readonly LevelFactor[];
  /** Première mesure du pilier : la case d'accord (Loi 25) est demandée. */
  consentRequired: boolean;
  country: Country;
  sex: Sex;
  onSaved?: (result: Extract<RecordResult, { ok: true }>) => void;
}) {
  const t = useTranslations("Levels.form");
  const tFields = useTranslations("Levels.fields");
  const tErrors = useTranslations("Levels.errors");
  const id = useId();
  const fields = fieldsOf(factors);
  const pillar = factorPillar(factors[0] as LevelFactor);
  const [values, setValues] = useState<Partial<Record<MeasureField, string>>>(
    {},
  );
  const [consent, setConsent] = useState(false);
  const [invalid, setInvalid] = useState<Set<string>>(new Set());
  const [error, setError] = useState<LevelError | null>(null);
  const [pending, startTransition] = useTransition();
  const currency = country === "US" ? "USD" : "CAD";

  const set = (field: MeasureField) => (value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setInvalid((current) => {
      const next = new Set(current);
      next.delete(field);
      return next;
    });
  };

  function submit() {
    setError(null);
    // Champs vides : absents (le schéma signale ceux qui manquent)
    const answers = Object.fromEntries(
      Object.entries(values).filter(([, value]) => value.trim() !== ""),
    );
    const parsed = measureAnswersSchema(factors).safeParse(answers);
    if (!parsed.success) {
      setInvalid(new Set(parsed.error.issues.map((i) => String(i.path[0]))));
      setError("invalid");
      return;
    }
    if (consentRequired && !consent) {
      setError("consentRequired");
      return;
    }
    startTransition(async () => {
      const result = await recordMeasurementsAction({
        factors,
        answers: parsed.data,
        consent,
      });
      if (result.ok) onSaved?.(result);
      else setError(result.error);
    });
  }

  const unit = (field: MeasureField) => {
    const kind = UNITS[field];
    if (!kind) return null;
    if (kind === "money") return currency;
    if (kind === "monthly") return t("perMonth", { currency });
    if (kind === "weekly") return t("perWeek");
    return kind;
  };

  const hint = (field: Exclude<MeasureField, "reachSide">) =>
    field === "pushUps"
      ? tFields(`pushUps.hint.${sex === "female" ? "knees" : "full"}`)
      : tFields(`${field}.hint`);

  return (
    <form
      noValidate
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <p className="text-sm text-muted-foreground">
        {pillar === "physical" ? t("physicalHint") : t("financialHint")}
      </p>

      {fields.map((field) =>
        field === "reachSide" ? (
          <Field
            key={field}
            id={`${id}-${field}`}
            label={tFields("reachSide.label")}
            error={invalid.has(field) ? t("fieldError") : undefined}
            group
          >
            <RadioGroupPrimitive.Root
              aria-labelledby={`${id}-${field}-label`}
              value={values.reachSide ?? ""}
              onValueChange={set("reachSide")}
              className="flex flex-wrap gap-2"
            >
              {REACH_SIDES.map((side) => (
                <RadioGroupPrimitive.Item
                  key={side}
                  value={side}
                  className="h-9 rounded-full border border-foreground/10 bg-foreground/[0.03] px-3.5 text-sm font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 data-checked:border-primary data-checked:bg-primary/15 data-checked:text-foreground"
                >
                  {tFields(`reachSide.options.${side}`)}
                </RadioGroupPrimitive.Item>
              ))}
            </RadioGroupPrimitive.Root>
          </Field>
        ) : (
          <Field
            key={field}
            id={`${id}-${field}`}
            label={tFields(`${field}.label`)}
            hint={hint(field)}
            error={invalid.has(field) ? t("fieldError") : undefined}
          >
            <div className="flex items-center gap-2">
              <Input
                id={`${id}-${field}`}
                name={field}
                type="number"
                inputMode={field === "benchKg" ? "decimal" : "numeric"}
                step={field === "benchKg" ? 0.5 : 1}
                min={0}
                value={values[field] ?? ""}
                aria-invalid={invalid.has(field) || undefined}
                onChange={(event) => set(field)(event.target.value)}
                className="max-w-48"
              />
              {unit(field) ? (
                <span className="text-sm text-muted-foreground">
                  {unit(field)}
                </span>
              ) : null}
            </div>
          </Field>
        ),
      )}

      {consentRequired ? (
        <section className="flex flex-col gap-4 border-t border-foreground/8 pt-6">
          <p className="flex gap-2 text-sm text-muted-foreground">
            <ShieldCheck
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-primary"
            />
            {t("notice")}
          </p>
          <div className="flex items-start gap-3">
            <Checkbox
              id={`${id}-consent`}
              checked={consent}
              onCheckedChange={(checked) => {
                setConsent(checked === true);
                if (checked === true && error === "consentRequired") {
                  setError(null);
                }
              }}
              className="mt-0.5"
            />
            <label htmlFor={`${id}-consent`} className="text-sm">
              {t("consent")}
            </label>
          </div>
        </section>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <CircleAlert aria-hidden="true" />
          <AlertDescription>{tErrors(error)}</AlertDescription>
        </Alert>
      ) : null}

      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? (
          <LoaderCircle aria-hidden="true" className="animate-spin" />
        ) : null}
        {pending ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}

function Field({
  id,
  label,
  hint,
  error,
  group = false,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  /** Groupe de choix : le libellé nomme le groupe plutôt qu'un champ. */
  group?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      {group ? (
        <span id={`${id}-label`} className="text-sm font-medium">
          {label}
        </span>
      ) : (
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
      )}
      {hint ? (
        <p className="text-xs whitespace-pre-line text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {children}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
