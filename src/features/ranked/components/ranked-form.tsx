"use client";

import { CircleAlert, Eye, LoaderCircle, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { useId, useState, useTransition, type ReactNode } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { Country, Sex } from "@/features/profile/details";
import { useRouter } from "@/i18n/navigation";
import { submitRankedAction } from "../actions";
import {
  REACH_SIDES,
  rankedAnswersSchema,
  type RankedAnswers,
} from "../questionnaire";
import type { RankedError } from "../rules";
import { BodyTypePicker } from "./body-type-picker";

type Values = Record<keyof RankedAnswers, string>;

const EMPTY: Values = {
  heightCm: "",
  weightKg: "",
  bodyType: "",
  reachSide: "",
  reachCm: "",
  runMeters: "",
  pushUps: "",
  squats: "",
  jumpCm: "",
  netIncome: "",
  assets: "",
  debts: "",
  monthlyExpenses: "",
  weeklyHours: "",
};

const toValues = (answers: RankedAnswers | null): Values =>
  answers
    ? (Object.fromEntries(
        Object.keys(EMPTY).map((key) => [
          key,
          String(answers[key as keyof RankedAnswers] ?? ""),
        ]),
      ) as Values)
    : EMPTY;

/** Champs numériques : chacun a une explication sous son libellé. */
type NumberField =
  | "heightCm"
  | "weightKg"
  | "reachCm"
  | "runMeters"
  | "pushUps"
  | "squats"
  | "jumpCm"
  | "netIncome"
  | "assets"
  | "debts"
  | "monthlyExpenses"
  | "weeklyHours";

/**
 * Questionnaire du mode Ranked : corps, physique, financier et accord (Loi 25).
 * Le pays (devise) et le sexe (pompes, silhouettes) viennent du compte.
 */
export function RankedForm({
  initial,
  country,
  sex,
}: {
  initial: RankedAnswers | null;
  country: Country;
  sex: Sex;
}) {
  const t = useTranslations("Ranked.form");
  const tQuestions = useTranslations("Ranked.questions");
  const tErrors = useTranslations("Ranked.errors");
  const id = useId();
  const router = useRouter();
  const [values, setValues] = useState(() => toValues(initial));
  const [consent, setConsent] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Set<string>>(new Set());
  const [error, setError] = useState<RankedError | null>(null);
  const [pending, startTransition] = useTransition();

  const set = (key: keyof Values) => (value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => {
      const next = new Set(current);
      next.delete(key);
      return next;
    });
  };
  const currency = country === "US" ? "USD" : "CAD";
  // Les normes féminines de la SCPE comptent les pompes sur les genoux
  const pushUpHint = sex === "female" ? "knees" : "full";

  function submit() {
    setError(null);
    // Champs vides : absents (le schéma signale ceux qui manquent)
    const input = Object.fromEntries(
      Object.entries(values).filter(([, value]) => value.trim() !== ""),
    );
    const parsed = rankedAnswersSchema.safeParse(input);
    if (!parsed.success) {
      setFieldErrors(
        new Set(parsed.error.issues.map((issue) => String(issue.path[0]))),
      );
      setError("invalid");
      return;
    }
    if (!consent) {
      setError("consentRequired");
      return;
    }
    startTransition(async () => {
      const result = await submitRankedAction({
        answers: parsed.data,
        consent: true,
      });
      if (result.ok) router.push("/profile/ranked");
      else setError(result.error);
    });
  }

  const number = (
    key: NumberField,
    options: { unit?: string; min?: number; hint?: string } = {},
  ) => (
    <Field
      id={`${id}-${key}`}
      label={tQuestions(`${key}.label`)}
      hint={
        options.hint ??
        (key === "pushUps" ? undefined : tQuestions(`${key}.hint`))
      }
      error={fieldErrors.has(key) ? t("fieldError") : undefined}
    >
      <div className="flex items-center gap-2">
        <Input
          id={`${id}-${key}`}
          type="number"
          inputMode="numeric"
          step={1}
          min={options.min}
          value={values[key]}
          aria-invalid={fieldErrors.has(key) || undefined}
          onChange={(event) => set(key)(event.target.value)}
          className="max-w-48"
        />
        {options.unit ? (
          <span className="text-sm text-muted-foreground">{options.unit}</span>
        ) : null}
      </div>
    </Field>
  );

  const choice = <T extends string>(
    key: keyof Values,
    options: readonly T[],
    label: (option: T) => string,
  ) => (
    <Field
      id={`${id}-${key}`}
      label={tQuestions(`${key}.label`)}
      error={fieldErrors.has(key) ? t("fieldError") : undefined}
      group
    >
      <RadioGroupPrimitive.Root
        aria-labelledby={`${id}-${key}-label`}
        value={values[key]}
        onValueChange={set(key)}
        className="flex flex-wrap gap-2"
      >
        {options.map((option) => (
          <RadioGroupPrimitive.Item
            key={option}
            value={option}
            className="h-9 rounded-full border border-white/10 bg-white/[0.03] px-3.5 text-sm font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 data-checked:border-primary data-checked:bg-primary/15 data-checked:text-foreground"
          >
            {label(option)}
          </RadioGroupPrimitive.Item>
        ))}
      </RadioGroupPrimitive.Root>
    </Field>
  );

  return (
    <form
      noValidate
      className="flex flex-col gap-8"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <Section title={t("sections.body")} hint={t("hints.body")}>
        {number("heightCm", { unit: "cm", min: 100 })}
        {number("weightKg", { unit: "kg", min: 30 })}
        <Field
          id={`${id}-bodyType`}
          label={tQuestions("bodyType.label")}
          hint={tQuestions("bodyType.hint")}
          error={fieldErrors.has("bodyType") ? t("fieldError") : undefined}
          group
        >
          <BodyTypePicker
            sex={sex}
            value={values.bodyType}
            onChange={set("bodyType")}
            labelledBy={`${id}-bodyType-label`}
            invalid={fieldErrors.has("bodyType")}
          />
        </Field>
      </Section>

      <Section title={t("sections.physical")} hint={t("hints.physical")}>
        {choice("reachSide", REACH_SIDES, (option) =>
          tQuestions(`reachSide.options.${option}`),
        )}
        {number("reachCm", { unit: "cm", min: 0 })}
        {number("runMeters", { unit: "m", min: 0 })}
        {number("pushUps", {
          min: 0,
          hint: tQuestions(`pushUps.hint.${pushUpHint}`),
        })}
        {number("squats", { min: 0 })}
        {number("jumpCm", { unit: "cm", min: 0 })}
      </Section>

      <Section title={t("sections.financial")} hint={t("hints.financial")}>
        {number("netIncome", { unit: currency, min: 0 })}
        {number("assets", { unit: currency, min: 0 })}
        {number("debts", { unit: currency, min: 0 })}
        {number("monthlyExpenses", {
          unit: t("perMonth", { currency }),
          min: 0,
        })}
        {number("weeklyHours", { unit: t("perWeek"), min: 0 })}
      </Section>

      <section className="flex flex-col gap-4 border-t border-white/8 pt-6">
        <p className="flex gap-2 text-sm text-muted-foreground">
          <Eye
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 text-primary"
          />
          {t("public")}
        </p>
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

      {error ? (
        <Alert variant="destructive">
          <CircleAlert aria-hidden="true" />
          <AlertDescription>{tErrors(error)}</AlertDescription>
        </Alert>
      ) : null}

      <Button type="submit" size="lg" disabled={pending} className="w-fit">
        {pending ? (
          <LoaderCircle aria-hidden="true" className="animate-spin" />
        ) : null}
        {pending ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-5 border-t border-white/8 pt-6">
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-lg font-bold">{title}</h2>
        {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
      </div>
      {children}
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
