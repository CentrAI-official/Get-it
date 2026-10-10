"use client";

import { ArrowLeft, ArrowRight, CircleAlert, LoaderCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { Pillar } from "@/config/pillars";
import {
  completeOnboardingAction,
  type OnboardingActionResult,
} from "../actions";
import {
  aboutStepSchema,
  goalsStepSchema,
  MAX_GOALS,
  onboardingSchema,
  pillarsStepSchema,
  type OnboardingDraft,
} from "../schemas";
import { AboutStep } from "./about-step";
import { GoalsStep } from "./goals-step";
import { PillarsStep } from "./pillars-step";
import { ONBOARDING_STEPS, type OnboardingStep } from "./steps";
import { SituationStep } from "./situation-step";
import { SummaryStep } from "./summary-step";
import { TimeStep } from "./time-step";

const EMPTY_DRAFT: OnboardingDraft = {
  displayName: "",
  occupation: null,
  pillars: [],
  goals: [],
  assessments: {},
  dailyMinutes: null,
};

/** Vrai si l'étape est assez remplie pour continuer (le serveur revalide tout). */
function isStepComplete(step: OnboardingStep, draft: OnboardingDraft) {
  switch (step) {
    case "about":
      return aboutStepSchema.safeParse(draft).success;
    case "pillars":
      return pillarsStepSchema.safeParse(draft).success;
    case "goals":
      return goalsStepSchema.safeParse(draft).success;
    case "situation":
      return draft.pillars.every((pillar) => draft.assessments[pillar]);
    case "time":
      return draft.dailyMinutes !== null;
    case "summary":
      return onboardingSchema.safeParse(draft).success;
  }
}

export function OnboardingWizard() {
  const t = useTranslations("Onboarding");
  const locale = useLocale();
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [stepIndex, setStepIndex] = useState(0);
  const [error, setError] = useState<OnboardingActionResult["error"] | null>(
    null,
  );
  const [isPending, startTransition] = useTransition();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const hasNavigated = useRef(false);

  const step = ONBOARDING_STEPS[stepIndex] ?? "about";
  const isLastStep = stepIndex === ONBOARDING_STEPS.length - 1;
  const canContinue = isStepComplete(step, draft);

  // À chaque étape, le focus revient sur le titre pour les lecteurs d'écran et le clavier
  useEffect(() => {
    if (hasNavigated.current) headingRef.current?.focus();
  }, [stepIndex]);

  function update(patch: Partial<OnboardingDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  /** Retirer un pilier retire aussi ses objectifs et son évaluation. */
  function setPillars(pillars: Pillar[]) {
    setDraft((current) => ({
      ...current,
      pillars,
      goals: current.goals.filter((goal) => pillars.includes(goal.pillar)),
      assessments: Object.fromEntries(
        pillars.flatMap((pillar) => {
          const score = current.assessments[pillar];
          return score ? [[pillar, score]] : [];
        }),
      ),
    }));
  }

  function goTo(index: number) {
    hasNavigated.current = true;
    setError(null);
    setStepIndex(index);
    window.scrollTo({ top: 0 });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canContinue || isPending) return;
    if (!isLastStep) {
      goTo(stepIndex + 1);
      return;
    }
    startTransition(async () => {
      // En cas de succès, l'action redirige vers la page Aujourd'hui
      const result = await completeOnboardingAction(draft, locale);
      setError(result.error);
    });
  }

  const headers: Record<
    OnboardingStep,
    { title: string; description: string }
  > = {
    about: { title: t("about.title"), description: t("about.description") },
    pillars: {
      title: t("pillars.title"),
      description: t("pillars.description"),
    },
    goals: {
      title: t("goals.title"),
      description: t("goals.description", { max: MAX_GOALS }),
    },
    situation: {
      title: t("situation.title"),
      description: t("situation.description"),
    },
    time: { title: t("time.title"), description: t("time.description") },
    summary: {
      title: t("summary.title"),
      description: t("summary.description"),
    },
  };
  const stepLabel = t("stepLabel", {
    current: stepIndex + 1,
    total: ONBOARDING_STEPS.length,
  });

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="flex flex-col gap-8 rounded-3xl glass p-5 sm:p-8"
    >
      <div className="flex flex-col gap-3">
        <p className="font-mono text-xs tracking-[0.12em] text-muted-foreground uppercase">
          {stepLabel}
        </p>
        <Progress
          aria-hidden="true"
          value={((stepIndex + 1) / ONBOARDING_STEPS.length) * 100}
        />
      </div>

      <div className="flex flex-col gap-2">
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="font-heading text-3xl leading-tight font-bold tracking-tight text-balance outline-none sm:text-4xl"
        >
          {headers[step].title}
        </h1>
        <p className="text-pretty text-muted-foreground">
          {headers[step].description}
        </p>
      </div>

      {step === "about" ? <AboutStep draft={draft} update={update} /> : null}
      {step === "pillars" ? (
        <PillarsStep draft={draft} update={update} setPillars={setPillars} />
      ) : null}
      {step === "goals" ? <GoalsStep draft={draft} update={update} /> : null}
      {step === "situation" ? (
        <SituationStep draft={draft} update={update} />
      ) : null}
      {step === "time" ? <TimeStep draft={draft} update={update} /> : null}
      {step === "summary" ? (
        <SummaryStep
          draft={draft}
          onEdit={(target) => goTo(ONBOARDING_STEPS.indexOf(target))}
        />
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <CircleAlert aria-hidden="true" />
          <AlertDescription>{t(`errors.${error}`)}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex items-center justify-between gap-3 border-t border-white/5 pt-6">
        {stepIndex > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="lg"
            className="h-10"
            disabled={isPending}
            onClick={() => goTo(stepIndex - 1)}
          >
            <ArrowLeft aria-hidden="true" />
            {t("back")}
          </Button>
        ) : (
          <span />
        )}
        <Button
          type="submit"
          size="lg"
          className="h-10 px-5 text-base"
          disabled={!canContinue || isPending}
        >
          {isPending ? (
            <>
              <LoaderCircle aria-hidden="true" className="animate-spin" />
              {t("finishing")}
            </>
          ) : (
            <>
              {isLastStep ? t("finish") : t("next")}
              <ArrowRight aria-hidden="true" />
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
