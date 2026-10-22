"use client";

import { CircleAlert, LoaderCircle, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, useTransition, type ReactNode } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { generatePlanAction, type GeneratePlanResult } from "../actions";
import {
  isVisible,
  otherKey,
  QUESTIONNAIRES,
  type Answers,
  type DevelopmentKind,
  type Field,
} from "../questionnaires";

const chip =
  "rounded-full border px-3.5 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50";
const chipOn = "border-primary bg-primary/15 text-foreground";
const chipOff =
  "border-white/10 bg-white/[0.03] text-muted-foreground hover:text-foreground";

type Values = Record<string, unknown>;

type QuestionnaireProps = {
  kind: DevelopmentKind;
  /** Réponses précédentes (refaire un plan). */
  initial: Answers | null;
  /** Jour de demain, AAAA-MM-JJ (dates à venir). */
  minDate: string;
  redo: boolean;
  /** Plan créé : la page a déjà été rafraîchie avec le nouveau plan. */
  onDone: () => void;
  onCrisis: () => void;
  onCancel?: () => void;
};

/** Champ numérique : la saisie reste du texte, convertie à l'envoi. */
const toNumber = (value: unknown) => {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return undefined;
  const normalized = value.replace(",", ".").replace(/\s/g, "");
  return normalized === "" ? undefined : Number(normalized);
};

/** Réponses envoyées au serveur : nombres convertis, le reste tel quel. */
function toPayload(kind: DevelopmentKind, values: Values) {
  const payload: Values = { ...values };
  for (const field of QUESTIONNAIRES[kind].flatMap(
    (section) => section.fields,
  )) {
    const value = values[field.id];
    if (value === undefined) continue;
    if (field.type === "number" || field.type === "money") {
      payload[field.id] = toNumber(value);
    } else if (field.type === "weight") {
      const weight = value as { value?: unknown; unit: string };
      payload[field.id] = { unit: weight.unit, value: toNumber(weight.value) };
    } else if (field.type === "height") {
      const height = value as {
        unit: string;
        cm?: unknown;
        ft?: unknown;
        in?: unknown;
      };
      payload[field.id] =
        height.unit === "cm"
          ? { unit: "cm", cm: toNumber(height.cm) }
          : {
              unit: "ft",
              ft: toNumber(height.ft),
              in: toNumber(height.in) ?? 0,
            };
    }
  }
  return payload;
}

/**
 * Questionnaire d'un plan de « Mon développement ». Les questions viennent de
 * `QUESTIONNAIRES` ; celles qui dépendent d'une réponse n'apparaissent qu'au
 * besoin. Le serveur revalide tout.
 */
export function Questionnaire({
  kind,
  initial,
  minDate,
  redo,
  onDone,
  onCrisis,
  onCancel,
}: QuestionnaireProps) {
  const t = useTranslations("Development");
  const id = useId();
  const [values, setValues] = useState<Values>(() => ({ ...(initial ?? {}) }));
  const [consent, setConsent] = useState(false);
  const [result, setResult] = useState<Extract<
    GeneratePlanResult,
    { ok: false }
  > | null>(null);
  const [pending, startTransition] = useTransition();
  const fields = result?.fields ?? {};

  function set(key: string, value: unknown) {
    setValues((current) => ({ ...current, [key]: value }));
    // L'erreur d'une question disparaît dès qu'on y répond
    setResult((current) =>
      current?.fields?.[key]
        ? {
            ...current,
            fields: Object.fromEntries(
              Object.entries(current.fields).filter(([name]) => name !== key),
            ),
          }
        : current,
    );
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setResult(null);
    startTransition(async () => {
      const outcome = await generatePlanAction(
        kind,
        toPayload(kind, values),
        consent,
      );
      if (outcome.ok) {
        window.scrollTo({ top: 0 });
        onDone();
        return;
      }
      if (outcome.error === "crisis") {
        onCrisis();
        return;
      }
      setResult(outcome);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  if (pending) {
    return (
      <div
        role="status"
        className="flex flex-col items-center gap-4 py-16 text-center"
      >
        <span className="flex size-14 items-center justify-center rounded-full bg-primary/15 glow-primary">
          <LoaderCircle
            aria-hidden="true"
            className="size-6 animate-spin text-primary"
          />
        </span>
        <p className="font-heading text-lg font-bold">{t("loading.title")}</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          {t("loading.description")}
        </p>
      </div>
    );
  }

  const label = (field: Field) =>
    t(
      `questions.${kind}.${field.id}.label` as "questions.physical.fitness.label",
    );
  const option = (field: Field, value: string) =>
    value === "other"
      ? t("other")
      : t(
          `questions.${kind}.${field.id}.options.${value}` as "questions.physical.fitness.options.beginner",
        );
  const hint = (field: Field) => {
    const key =
      `questions.${kind}.${field.id}.hint` as "questions.physical.limitations.hint";
    return t.has(key) ? t(key) : undefined;
  };
  const error = (key: string) =>
    fields[key]
      ? t(`fieldErrors.${fields[key] === "required" ? "required" : "invalid"}`)
      : undefined;

  function renderField(field: Field): ReactNode {
    const fieldId = `${id}-${field.id}`;
    const value = values[field.id];
    const common = {
      id: fieldId,
      label: label(field),
      hint: hint(field),
      error: error(field.id),
      required: field.required,
    };

    switch (field.type) {
      case "choice":
      case "multi": {
        const multiple = field.type === "multi";
        const selected = multiple
          ? Array.isArray(value)
            ? (value as string[])
            : []
          : typeof value === "string"
            ? [value]
            : [];
        const options = [...field.options, ...(field.other ? ["other"] : [])];
        const toggle = (option: string) => {
          if (!multiple) return set(field.id, option);
          set(
            field.id,
            selected.includes(option)
              ? selected.filter((item) => item !== option)
              : [...selected, option],
          );
        };
        return (
          <Question {...common} group>
            <div
              role={multiple ? "group" : "radiogroup"}
              aria-labelledby={`${fieldId}-label`}
              className="flex flex-wrap gap-2"
            >
              {options.map((entry) => (
                <button
                  key={entry}
                  type="button"
                  role={multiple ? "checkbox" : "radio"}
                  aria-checked={selected.includes(entry)}
                  onClick={() => toggle(entry)}
                  className={cn(
                    chip,
                    selected.includes(entry) ? chipOn : chipOff,
                  )}
                >
                  {option(field, entry)}
                </button>
              ))}
            </div>
            {field.other && selected.includes("other") ? (
              <Input
                aria-label={t("otherLabel")}
                placeholder={t("otherLabel")}
                value={
                  typeof values[otherKey(field.id)] === "string"
                    ? (values[otherKey(field.id)] as string)
                    : ""
                }
                onChange={(event) =>
                  set(otherKey(field.id), event.target.value)
                }
                maxLength={200}
                aria-invalid={fields[otherKey(field.id)] ? true : undefined}
                className="h-11"
              />
            ) : null}
            {error(otherKey(field.id)) ? (
              <p role="alert" className="text-sm text-destructive">
                {error(otherKey(field.id))}
              </p>
            ) : null}
          </Question>
        );
      }
      case "number":
      case "money":
        return (
          <Question {...common}>
            <div className="flex items-center gap-2">
              <Input
                id={fieldId}
                inputMode={field.type === "money" ? "numeric" : "decimal"}
                value={value === undefined ? "" : String(value)}
                onChange={(event) => set(field.id, event.target.value)}
                aria-invalid={fields[field.id] ? true : undefined}
                className="h-11 w-36"
              />
              {field.type === "money" ? (
                <span className="text-muted-foreground">$</span>
              ) : null}
            </div>
          </Question>
        );
      case "weight": {
        const weight = (value ?? { unit: "kg" }) as {
          value?: unknown;
          unit: "kg" | "lb";
        };
        return (
          <Question {...common}>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                id={fieldId}
                inputMode="decimal"
                value={weight.value === undefined ? "" : String(weight.value)}
                onChange={(event) =>
                  set(field.id, { ...weight, value: event.target.value })
                }
                aria-invalid={fields[field.id] ? true : undefined}
                className="h-11 w-28"
              />
              <UnitToggle
                label={t("unitLabel")}
                units={["kg", "lb"]}
                value={weight.unit}
                onChange={(unit) => set(field.id, { ...weight, unit })}
                render={(unit) => t(`units.${unit}`)}
              />
            </div>
          </Question>
        );
      }
      case "height": {
        const height = (value ?? { unit: "cm" }) as {
          unit: "cm" | "ft";
          cm?: unknown;
          ft?: unknown;
          in?: unknown;
        };
        return (
          <Question {...common}>
            <div className="flex flex-wrap items-center gap-2">
              {height.unit === "cm" ? (
                <Input
                  id={fieldId}
                  inputMode="numeric"
                  value={height.cm === undefined ? "" : String(height.cm)}
                  onChange={(event) =>
                    set(field.id, { unit: "cm", cm: event.target.value })
                  }
                  aria-invalid={fields[field.id] ? true : undefined}
                  className="h-11 w-28"
                />
              ) : (
                <>
                  <Input
                    id={fieldId}
                    inputMode="numeric"
                    aria-label={t("units.ft")}
                    value={height.ft === undefined ? "" : String(height.ft)}
                    onChange={(event) =>
                      set(field.id, { ...height, ft: event.target.value })
                    }
                    className="h-11 w-20"
                  />
                  <span className="text-sm text-muted-foreground">
                    {t("units.ft")}
                  </span>
                  <Input
                    inputMode="numeric"
                    aria-label={t("units.in")}
                    value={height.in === undefined ? "" : String(height.in)}
                    onChange={(event) =>
                      set(field.id, { ...height, in: event.target.value })
                    }
                    className="h-11 w-20"
                  />
                  <span className="text-sm text-muted-foreground">
                    {t("units.in")}
                  </span>
                </>
              )}
              <UnitToggle
                label={t("unitLabel")}
                units={["cm", "ft"]}
                value={height.unit}
                onChange={(unit) => set(field.id, { unit })}
                render={(unit) => t(unit === "cm" ? "units.cm" : "units.feet")}
              />
            </div>
          </Question>
        );
      }
      case "text":
        return (
          <Question {...common}>
            {field.multiline ? (
              <Textarea
                id={fieldId}
                value={typeof value === "string" ? value : ""}
                onChange={(event) => set(field.id, event.target.value)}
                maxLength={field.maxLength}
                rows={3}
                aria-invalid={fields[field.id] ? true : undefined}
              />
            ) : (
              <Input
                id={fieldId}
                value={typeof value === "string" ? value : ""}
                onChange={(event) => set(field.id, event.target.value)}
                maxLength={field.maxLength}
                aria-invalid={fields[field.id] ? true : undefined}
                className="h-11"
              />
            )}
          </Question>
        );
      case "date":
        return (
          <Question {...common}>
            <Input
              id={fieldId}
              type="date"
              min={minDate}
              value={typeof value === "string" ? value : ""}
              onChange={(event) => set(field.id, event.target.value)}
              aria-invalid={fields[field.id] ? true : undefined}
              className="h-11 w-48"
            />
          </Question>
        );
      case "scale":
        return (
          <Question {...common} group>
            <div
              role="radiogroup"
              aria-labelledby={`${fieldId}-label`}
              className="grid grid-cols-5 gap-2"
            >
              {[1, 2, 3, 4, 5].map((score) => (
                <button
                  key={score}
                  type="button"
                  role="radio"
                  aria-checked={value === score}
                  onClick={() => set(field.id, score)}
                  className={cn(
                    "h-11 rounded-xl border font-mono font-bold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    value === score ? chipOn : chipOff,
                  )}
                >
                  {score}
                </button>
              ))}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                {t(
                  `questions.${kind}.${field.id}.min` as "questions.mental.stressLevel.min",
                )}
              </span>
              <span>
                {t(
                  `questions.${kind}.${field.id}.max` as "questions.mental.stressLevel.max",
                )}
              </span>
            </div>
          </Question>
        );
      case "yesno":
        return (
          <Question {...common} group>
            <div
              role="radiogroup"
              aria-labelledby={`${fieldId}-label`}
              className="flex gap-2"
            >
              {[true, false].map((answer) => (
                <button
                  key={String(answer)}
                  type="button"
                  role="radio"
                  aria-checked={value === answer}
                  onClick={() => set(field.id, answer)}
                  className={cn(chip, value === answer ? chipOn : chipOff)}
                >
                  {t(answer ? "yes" : "no")}
                </button>
              ))}
            </div>
          </Question>
        );
    }
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex max-w-2xl flex-col gap-8"
    >
      {result ? (
        <Alert variant="destructive">
          <CircleAlert aria-hidden="true" />
          <AlertDescription>{t(`errors.${result.error}`)}</AlertDescription>
        </Alert>
      ) : null}

      {QUESTIONNAIRES[kind].map((section, index) => (
        <section
          key={section.id}
          aria-labelledby={`${id}-${section.id}`}
          className={cn(
            "flex flex-col gap-6",
            index > 0 && "border-t border-white/8 pt-6",
          )}
        >
          <h2
            id={`${id}-${section.id}`}
            className="font-heading text-lg font-bold"
          >
            {t(`sections.${kind}.${section.id}` as "sections.physical.goal")}
          </h2>
          {section.fields
            .filter((field) => isVisible(field, values))
            .map((field) => (
              <div key={field.id}>{renderField(field)}</div>
            ))}
        </section>
      ))}

      <div className="flex flex-col gap-4 border-t border-white/8 pt-6">
        <label className="flex items-start gap-3 text-sm">
          <Checkbox
            checked={consent}
            onCheckedChange={(checked) => setConsent(checked === true)}
            className="mt-0.5"
          />
          <span>{t("consent")}</span>
        </label>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="lg" disabled={!consent}>
            <Sparkles aria-hidden="true" />
            {t(redo ? "submitRedo" : "submit")}
          </Button>
          {onCancel ? (
            <Button type="button" variant="ghost" size="lg" onClick={onCancel}>
              {t("cancel")}
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">{t("costNotice")}</p>
      </div>
    </form>
  );
}

function Question({
  id,
  label,
  hint,
  error,
  required,
  group = false,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  group?: boolean;
  children: ReactNode;
}) {
  const t = useTranslations("Development");
  const title = (
    <>
      {label}
      {required ? null : (
        <span className="font-normal text-muted-foreground">
          {" "}
          ({t("optional")})
        </span>
      )}
    </>
  );
  return (
    <div
      className="flex flex-col gap-2.5"
      data-invalid={error ? true : undefined}
    >
      {group ? (
        <p id={`${id}-label`} className="text-sm font-medium">
          {title}
        </p>
      ) : (
        <label htmlFor={id} className="text-sm font-medium">
          {title}
        </label>
      )}
      {hint ? (
        <p className="-mt-1 text-xs text-muted-foreground">{hint}</p>
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

function UnitToggle<T extends string>({
  label,
  units,
  value,
  onChange,
  render,
}: {
  label: string;
  units: readonly T[];
  value: T;
  onChange: (unit: T) => void;
  render: (unit: T) => string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex rounded-full border border-white/10 p-0.5"
    >
      {units.map((unit) => (
        <button
          key={unit}
          type="button"
          role="radio"
          aria-checked={value === unit}
          onClick={() => onChange(unit)}
          className={cn(
            "h-9 rounded-full px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            value === unit
              ? "bg-primary/15 text-foreground"
              : "text-muted-foreground",
          )}
        >
          {render(unit)}
        </button>
      ))}
    </div>
  );
}
