"use client";

import { CircleAlert, LoaderCircle, ShieldCheck } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { useId, useState, useTransition, type ReactNode } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { Country, Sex } from "@/features/profile/details";
import { REACH_SIDES } from "@/features/ranked/questionnaire";
import { oneRepMax } from "@/features/ranked/scoring";
import { WEIGHT_UNITS, type WeightUnit } from "@/features/workouts/rules";
import { cn } from "@/lib/utils";
import type { LevelError, RecordResult } from "@/server/levels/service";
import { recordMeasurementsAction } from "../actions";
import {
  EMPLOYMENT_STATUSES,
  factorPillar,
  fieldsOf,
  fromKilograms,
  measureAnswersSchema,
  toKilograms,
  type LevelFactor,
  type MeasureField,
} from "../factors";

/** Unité affichée à droite de chaque champ numérique. */
const UNITS: Partial<
  Record<MeasureField, "m" | "cm" | "weight" | "money" | "monthly" | "weekly">
> = {
  runMeters: "m",
  reachCm: "cm",
  jumpCm: "cm",
  bodyWeight: "weight",
  benchLoad: "weight",
  netIncome: "money",
  assets: "money",
  debts: "money",
  monthlyExpenses: "monthly",
  weeklyHours: "weekly",
};

/** Champs à choix (le reste est numérique). */
const CHOICES = {
  reachSide: REACH_SIDES,
  employment: EMPLOYMENT_STATUSES,
} as const;
type ChoiceField = keyof typeof CHOICES;
const isChoice = (field: MeasureField): field is ChoiceField =>
  field in CHOICES;

const CHIP =
  "h-9 rounded-full border border-foreground/10 bg-foreground/[0.03] px-3.5 text-sm font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 data-checked:border-primary data-checked:bg-primary/15 data-checked:text-foreground";

/**
 * Formulaire de mesures : toutes celles d'un pilier (première évaluation) ou
 * une seule (mesure refaite, ou corrigée dans les 48 h). Le pays (devise) et
 * le sexe (pompes sur les genoux pour les femmes, normes de la SCPE) viennent
 * du compte ; l'unité des poids est celle du carnet d'entraînement.
 */
export function MeasureForm({
  factors,
  consentRequired,
  country,
  sex,
  weightUnit,
  correct = false,
  onSaved,
}: {
  factors: readonly LevelFactor[];
  /** Première mesure du pilier : la case d'accord (Loi 25) est demandée. */
  consentRequired: boolean;
  country: Country;
  sex: Sex;
  /** Unité proposée pour le poids du corps et la charge. */
  weightUnit: WeightUnit;
  /** Remplace la dernière mesure (faute de saisie). */
  correct?: boolean;
  onSaved?: (result: Extract<RecordResult, { ok: true }>) => void;
}) {
  const t = useTranslations("Levels.form");
  const tFields = useTranslations("Levels.fields");
  const tErrors = useTranslations("Levels.errors");
  const format = useFormatter();
  const id = useId();
  // L'unité est un réglage du formulaire, pas une question
  const fields = fieldsOf(factors).filter((field) => field !== "weightUnit");
  const pillar = factorPillar(factors[0] as LevelFactor);
  const [values, setValues] = useState<Partial<Record<MeasureField, string>>>(
    {},
  );
  const [unit, setUnit] = useState<WeightUnit>(weightUnit);
  const [consent, setConsent] = useState(false);
  const [invalid, setInvalid] = useState<Set<string>>(new Set());
  const [error, setError] = useState<LevelError | null>(null);
  const [pending, startTransition] = useTransition();
  const currency = country === "US" ? "USD" : "CAD";
  const weighs = fields.includes("bodyWeight");

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
    const answers: Record<string, string> = Object.fromEntries(
      Object.entries(values).filter(([, value]) => value.trim() !== ""),
    );
    if (weighs) answers.weightUnit = unit;
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
        correct,
      });
      if (result.ok) onSaved?.(result);
      else setError(result.error);
    });
  }

  const unitLabel = (field: MeasureField) => {
    const kind = UNITS[field];
    if (!kind) return null;
    if (kind === "money") return currency;
    if (kind === "monthly") return t("perMonth", { currency });
    if (kind === "weekly") return t("perWeek");
    if (kind === "weight") return null;
    return kind;
  };

  const choiceLabel = (field: ChoiceField, option: string) =>
    field === "reachSide"
      ? tFields(`reachSide.options.${option as (typeof REACH_SIDES)[number]}`)
      : tFields(
          `employment.options.${option as (typeof EMPLOYMENT_STATUSES)[number]}`,
        );

  const hint = (field: Exclude<MeasureField, ChoiceField | "weightUnit">) =>
    field === "pushUps"
      ? tFields(`pushUps.hint.${sex === "female" ? "knees" : "full"}`)
      : tFields(`${field}.hint`);

  // Ce que les chiffres tapés donnent, pour voir tout de suite une erreur d'unité
  const number = (field: MeasureField) => {
    const value = Number((values[field] ?? "").replace(",", "."));
    return values[field]?.trim() && Number.isFinite(value) && value > 0
      ? value
      : null;
  };
  const otherUnit: WeightUnit = unit === "kg" ? "lb" : "kg";
  const converted = (field: MeasureField) => {
    const value = number(field);
    return value === null
      ? null
      : t("converted", {
          value: format.number(
            fromKilograms(toKilograms(value, unit), otherUnit),
            { maximumFractionDigits: 1 },
          ),
          unit: otherUnit,
        });
  };
  const body = number("bodyWeight");
  const load = number("benchLoad");
  const reps = number("benchReps");
  const ratio =
    body && load && reps && reps <= 10
      ? oneRepMax(toKilograms(load, unit), reps) / toKilograms(body, unit)
      : null;

  const unitSwitch = (
    <div
      role="radiogroup"
      aria-label={t("unitLabel")}
      className="flex shrink-0 rounded-full bg-foreground/[0.06] p-0.5"
    >
      {WEIGHT_UNITS.map((value) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={unit === value}
          onClick={() => setUnit(value)}
          className={cn(
            "h-8 min-w-11 rounded-full px-2.5 text-xs font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            unit === value
              ? "bg-background text-foreground shadow-xs"
              : "text-muted-foreground",
          )}
        >
          {value}
        </button>
      ))}
    </div>
  );

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

      {fields.map((field) => {
        if (isChoice(field)) {
          return (
            <Field
              key={field}
              id={`${id}-${field}`}
              label={tFields(`${field}.label`)}
              hint={
                field === "employment" ? tFields("employment.hint") : undefined
              }
              error={invalid.has(field) ? t("fieldError") : undefined}
              group
            >
              <RadioGroupPrimitive.Root
                aria-labelledby={`${id}-${field}-label`}
                value={values[field] ?? ""}
                onValueChange={set(field)}
                className="flex flex-wrap gap-2"
              >
                {CHOICES[field].map((option) => (
                  <RadioGroupPrimitive.Item
                    key={option}
                    value={option}
                    className={CHIP}
                  >
                    {choiceLabel(field, option)}
                  </RadioGroupPrimitive.Item>
                ))}
              </RadioGroupPrimitive.Root>
            </Field>
          );
        }
        const weight = UNITS[field] === "weight";
        return (
          <div key={field} className="flex flex-col gap-6">
            {field === "bodyWeight" ? <BenchSteps /> : null}
            <Field
              id={`${id}-${field}`}
              label={tFields(`${field}.label`)}
              hint={
                field === "weeklyHours" && values.employment
                  ? `${hint(field)}\n${tFields(`weeklyHours.byStatus.${values.employment as (typeof EMPLOYMENT_STATUSES)[number]}`)}`
                  : hint(field)
              }
              error={
                invalid.has(field)
                  ? weight
                    ? t("weightError")
                    : t("fieldError")
                  : undefined
              }
            >
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  id={`${id}-${field}`}
                  name={field}
                  type="number"
                  inputMode={weight ? "decimal" : "numeric"}
                  step={weight ? 0.5 : 1}
                  min={0}
                  value={values[field] ?? ""}
                  aria-invalid={invalid.has(field) || undefined}
                  onChange={(event) => set(field)(event.target.value)}
                  className="max-w-40"
                />
                {weight ? (
                  unitSwitch
                ) : unitLabel(field) ? (
                  <span className="text-sm text-muted-foreground">
                    {unitLabel(field)}
                  </span>
                ) : null}
              </div>
              {weight && converted(field) ? (
                <p className="text-xs text-muted-foreground tabular-nums">
                  {converted(field)}
                </p>
              ) : null}
            </Field>
            {field === "benchReps" && ratio !== null && body && load ? (
              <p
                role="status"
                className="rounded-2xl bg-primary/[0.07] p-4 text-sm text-pretty"
              >
                {t("benchPreview", {
                  max: `${format.number(
                    fromKilograms(
                      oneRepMax(toKilograms(load, unit), reps ?? 1),
                      unit,
                    ),
                    { maximumFractionDigits: 1 },
                  )} ${unit}`,
                  ratio: format.number(ratio, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }),
                })}
              </p>
            ) : null}
          </div>
        );
      })}

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
        {pending ? t("submitting") : correct ? t("submitCorrect") : t("submit")}
      </Button>
    </form>
  );
}

/** Comment faire le test du développé couché, étape par étape. */
function BenchSteps() {
  const t = useTranslations("Levels.fields.benchSteps");
  return (
    <section className="flex flex-col gap-2 rounded-2xl bg-foreground/[0.04] p-4">
      <h3 className="text-sm font-semibold">{t("title")}</h3>
      <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm text-pretty marker:font-semibold marker:text-primary">
        {(["warmUp", "choose", "lift", "count", "write"] as const).map(
          (step) => (
            <li key={step}>{t(step)}</li>
          ),
        )}
      </ol>
      <p className="text-xs text-pretty text-muted-foreground">
        {t("example")}
      </p>
      <p className="text-xs text-pretty text-muted-foreground">{t("safety")}</p>
    </section>
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
