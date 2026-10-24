"use client";

import { useState } from "react";
import type { CalendarData } from "../calendar";
import type { DevelopmentPlan } from "../plan";
import type { Answers, DevelopmentKind } from "../questionnaires";
import { CrisisResources } from "./crisis-resources";
import { PlanView } from "./plan-view";
import { Questionnaire } from "./questionnaire";

type DevelopmentFlowProps = {
  kind: DevelopmentKind;
  plan: DevelopmentPlan | null;
  answers: Answers | null;
  updatedAt: string | null;
  /** Calendrier du plan (mois en cours). */
  calendar: CalendarData;
  minDate: string;
  suggestBusiness: boolean;
};

/** Questionnaire, plan ou ressources d'aide, selon où en est la personne. */
export function DevelopmentFlow({
  kind,
  plan,
  answers,
  updatedAt,
  calendar,
  minDate,
  suggestBusiness,
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
        updatedAt={updatedAt}
        calendar={calendar}
        suggestBusiness={suggestBusiness}
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
