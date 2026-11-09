"use client";

import { useState } from "react";
import type { PlanLogPage } from "@/features/plan-logs/rules";
import type { WorkoutPageData } from "@/features/workouts/rules";
import type { CalendarData } from "../calendar";
import type { DevelopmentPlan, PlanLanguage } from "../plan";
import type { Answers, DevelopmentKind } from "../questionnaires";
import { CrisisResources } from "./crisis-resources";
import { PlanView } from "./plan-view";
import { Questionnaire } from "./questionnaire";

type DevelopmentFlowProps = {
  kind: DevelopmentKind;
  plan: DevelopmentPlan | null;
  /** Langue du plan enregistré. */
  language: PlanLanguage | null;
  answers: Answers | null;
  updatedAt: string | null;
  /** Calendrier du plan (mois en cours). */
  calendar: CalendarData;
  /** Carnet d'entraînement (plan d'entraînement seulement). */
  workouts: WorkoutPageData | null;
  /** Éléments cochés (les autres plans). */
  logs: PlanLogPage | null;
  minDate: string;
};

/** Questionnaire, plan ou ressources d'aide, selon où en est la personne. */
export function DevelopmentFlow({
  kind,
  plan,
  language,
  answers,
  updatedAt,
  calendar,
  workouts,
  logs,
  minDate,
}: DevelopmentFlowProps) {
  const [mode, setMode] = useState<"plan" | "form" | "crisis">(
    plan ? "plan" : "form",
  );

  if (mode === "crisis") {
    return <CrisisResources onBack={() => setMode("form")} />;
  }
  if (mode === "plan" && plan && updatedAt) {
    return (
      <PlanView
        kind={kind}
        plan={plan}
        language={language ?? "fr"}
        updatedAt={updatedAt}
        calendar={calendar}
        workouts={workouts}
        logs={logs}
        onRedo={() => {
          setMode("form");
          window.scrollTo({ top: 0 });
        }}
        onCrisis={() => setMode("crisis")}
      />
    );
  }
  return (
    <Questionnaire
      kind={kind}
      initial={answers}
      minDate={minDate}
      redo={plan !== null}
      onDone={() => setMode("plan")}
      onCrisis={() => setMode("crisis")}
      onCancel={plan ? () => setMode("plan") : undefined}
    />
  );
}
