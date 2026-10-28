"use client";

import { CircleAlert, LoaderCircle, RotateCcw, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScheduleLabel } from "@/features/habits/components/schedule-label";
import { Link } from "@/i18n/navigation";
import { QUESTION_LIMITS, type GoalPlan, type GoalQuestions } from "../plan";
import {
  applyGoalPlanAction,
  generateGoalPlanAction,
  generateGoalQuestionsAction,
  type GeneratePlanResult,
} from "../plan-actions";

type GoalPlanCardProps = {
  goalId: string;
  /** « consent » : Get iT AI doit d'abord être autorisé. */
  access: "ready" | "consent";
};

type PlanError = Extract<GeneratePlanResult, { status: "error" }>["error"];

type State =
  | {
      step: "idle";
      added?: { milestones: number; tasks: number; habits: number };
    }
  | { step: "asking" }
  | { step: "questions"; questions: GoalQuestions }
  | { step: "loading" }
  | { step: "proposal"; plan: GoalPlan; keep: Set<string> }
  | { step: "error"; error: PlanError | "apply" };

/** Clé d'un élément du plan, pour savoir s'il est gardé. */
const keyOf = (group: "milestones" | "tasks" | "habits", index: number) =>
  `${group}:${index}`;

/** « Créer mon plan avec l'IA » (§8) : Get iT AI propose, l'utilisateur choisit. */
export function GoalPlanCard({ goalId, access }: GoalPlanCardProps) {
  const t = useTranslations("Goals.plan");
  const idPrefix = useId();
  const [state, setState] = useState<State>({ step: "idle" });
  const [applying, startApply] = useTransition();
  // Réponses aux questions de Get iT AI, gardées pour « Proposer un autre plan »
  const [answers, setAnswers] = useState<
    { question: string; answer: string }[]
  >([]);

  /** Étape 1 : Get iT AI pose ses questions sur la situation de la personne. */
  async function ask() {
    setState({ step: "asking" });
    setAnswers([]);
    const result = await generateGoalQuestionsAction(goalId);
    if (result.status === "error") {
      setState({ step: "error", error: result.error });
      return;
    }
    setAnswers(
      result.questions.questions.map((item) => ({
        question: item.question,
        answer: "",
      })),
    );
    setState({ step: "questions", questions: result.questions });
  }

  /** Étape 2 : le plan, d'après les réponses. */
  async function generate() {
    setState({ step: "loading" });
    const result = await generateGoalPlanAction(goalId, answers);
    if (result.status === "error") {
      setState({ step: "error", error: result.error });
      return;
    }
    // Tout est gardé par défaut ; l'utilisateur décoche ce qu'il ne veut pas
    const keep = new Set<string>();
    result.plan.milestones.forEach((_, i) => keep.add(keyOf("milestones", i)));
    result.plan.tasks.forEach((_, i) => keep.add(keyOf("tasks", i)));
    result.plan.habits.forEach((_, i) => keep.add(keyOf("habits", i)));
    setState({ step: "proposal", plan: result.plan, keep });
  }

  function toggle(key: string, checked: boolean) {
    setState((current) => {
      if (current.step !== "proposal") return current;
      const keep = new Set(current.keep);
      if (checked) keep.add(key);
      else keep.delete(key);
      return { ...current, keep };
    });
  }

  function apply(plan: GoalPlan, keep: Set<string>) {
    const selection = {
      milestones: plan.milestones
        .filter((_, i) => keep.has(keyOf("milestones", i)))
        .map((item) => item.title),
      tasks: plan.tasks.filter((_, i) => keep.has(keyOf("tasks", i))),
      habits: plan.habits.filter((_, i) => keep.has(keyOf("habits", i))),
    };
    startApply(async () => {
      const result = await applyGoalPlanAction(goalId, selection);
      setState(
        result.status === "success"
          ? {
              step: "idle",
              added: {
                milestones: selection.milestones.length,
                tasks: selection.tasks.length,
                habits: selection.habits.length,
              },
            }
          : { step: "error", error: "apply" },
      );
    });
  }

  return (
    <section
      aria-labelledby={`${idPrefix}-title`}
      aria-busy={state.step === "loading" || state.step === "asking"}
      className="flex flex-col gap-4 border-t border-foreground/8 pt-6"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 glow-primary">
          <Sparkles aria-hidden="true" className="size-5 text-primary" />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h2
            id={`${idPrefix}-title`}
            className="caps-label text-muted-foreground"
          >
            {t("title")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
      </div>

      {access === "consent" ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-muted-foreground">{t("consent")}</p>
          <Button asChild variant="outline">
            <Link href="/coach">{t("consentCta")}</Link>
          </Button>
        </div>
      ) : state.step === "asking" ? (
        <p
          role="status"
          className="flex items-center gap-2 text-sm text-muted-foreground"
        >
          <LoaderCircle
            aria-hidden="true"
            className="size-4 animate-spin text-primary"
          />
          {t("asking")}
        </p>
      ) : state.step === "questions" ? (
        <Questions
          questions={state.questions}
          answers={answers}
          idPrefix={idPrefix}
          onAnswer={(index, answer) =>
            setAnswers((current) =>
              current.map((item, position) =>
                position === index ? { ...item, answer } : item,
              ),
            )
          }
          onSubmit={() => void generate()}
          onCancel={() => setState({ step: "idle" })}
        />
      ) : state.step === "loading" ? (
        <p
          role="status"
          className="flex items-center gap-2 text-sm text-muted-foreground"
        >
          <LoaderCircle
            aria-hidden="true"
            className="size-4 animate-spin text-primary"
          />
          {t("loading")}
        </p>
      ) : state.step === "proposal" ? (
        <Proposal
          plan={state.plan}
          keep={state.keep}
          idPrefix={idPrefix}
          applying={applying}
          onToggle={toggle}
          onApply={() => apply(state.plan, state.keep)}
          onRetry={() => void generate()}
          onCancel={() => setState({ step: "idle" })}
        />
      ) : (
        <div className="flex flex-col items-start gap-3">
          {state.step === "error" ? (
            <p
              role="alert"
              className="flex items-start gap-2 text-sm text-destructive"
            >
              <CircleAlert
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0"
              />
              {t(`errors.${state.error}`)}
            </p>
          ) : state.added ? (
            <p role="status" className="text-sm text-primary">
              {t("added", state.added)}
            </p>
          ) : null}
          <Button onClick={() => void ask()}>
            <Sparkles aria-hidden="true" />
            {state.step === "idle" && !state.added ? t("generate") : t("again")}
          </Button>
        </div>
      )}
    </section>
  );
}

/**
 * Les questions de Get iT AI, comme une conversation : sa bulle d'abord, puis
 * une réponse par question (facultative).
 */
function Questions({
  questions,
  answers,
  idPrefix,
  onAnswer,
  onSubmit,
  onCancel,
}: {
  questions: GoalQuestions;
  answers: { question: string; answer: string }[];
  idPrefix: string;
  onAnswer: (index: number, answer: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("Goals.plan");
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      className="flex flex-col gap-4"
    >
      <div className="flex items-start gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15">
          <Sparkles aria-hidden="true" className="size-4 text-primary" />
        </span>
        <p className="rounded-2xl rounded-tl-md bg-foreground/[0.06] px-3.5 py-2.5 text-sm">
          {questions.intro || t("questionsIntro")}
        </p>
      </div>
      <ol className="flex flex-col gap-4">
        {questions.questions.map((item, index) => {
          const id = `${idPrefix}-answer-${index}`;
          return (
            <li key={id} className="flex flex-col gap-2">
              <label
                htmlFor={id}
                className="ml-10 rounded-2xl rounded-tl-md bg-foreground/[0.06] px-3.5 py-2.5 text-sm"
              >
                {item.question}
              </label>
              <textarea
                id={id}
                rows={2}
                maxLength={QUESTION_LIMITS.answer}
                value={answers[index]?.answer ?? ""}
                placeholder={item.hint}
                onChange={(event) => onAnswer(index, event.target.value)}
                className="ml-auto w-[85%] resize-none rounded-2xl rounded-tr-md border border-primary/30 bg-primary/[0.06] px-3.5 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </li>
          );
        })}
      </ol>
      <p className="text-xs text-muted-foreground">{t("questionsHelp")}</p>
      <div className="flex flex-wrap gap-2">
        <Button type="submit">
          <Sparkles aria-hidden="true" />
          {t("generateFromAnswers")}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}

type ProposalProps = {
  plan: GoalPlan;
  keep: Set<string>;
  idPrefix: string;
  applying: boolean;
  onToggle: (key: string, checked: boolean) => void;
  onApply: () => void;
  onRetry: () => void;
  onCancel: () => void;
};

function Proposal({
  plan,
  keep,
  idPrefix,
  applying,
  onToggle,
  onApply,
  onRetry,
  onCancel,
}: ProposalProps) {
  const t = useTranslations("Goals.plan");

  function item(key: string, title: string, meta?: React.ReactNode) {
    const id = `${idPrefix}-${key}`;
    return (
      <li
        key={key}
        className="flex items-start gap-3 border-b border-foreground/8 py-2.5"
      >
        <Checkbox
          id={id}
          checked={keep.has(key)}
          onCheckedChange={(checked) => onToggle(key, checked === true)}
          className="mt-0.5"
        />
        <label
          htmlFor={id}
          className="flex min-w-0 flex-1 cursor-pointer flex-col gap-0.5"
        >
          <span className="text-sm break-words">{title}</span>
          {meta ? (
            <span className="text-xs text-muted-foreground">{meta}</span>
          ) : null}
        </label>
      </li>
    );
  }

  const groups = [
    {
      key: "milestones" as const,
      items: plan.milestones.map((m, i) =>
        item(keyOf("milestones", i), m.title),
      ),
    },
    {
      key: "tasks" as const,
      items: plan.tasks.map((task, i) =>
        item(keyOf("tasks", i), task.title, t("due", { days: task.dueInDays })),
      ),
    },
    {
      key: "habits" as const,
      items: plan.habits.map((habit, i) =>
        item(
          keyOf("habits", i),
          habit.title,
          <ScheduleLabel weekdays={habit.weekdays} />,
        ),
      ),
    },
  ].filter((group) => group.items.length > 0);

  return (
    <div className="flex flex-col gap-4">
      {plan.summary ? (
        <p className="text-sm text-pretty">{plan.summary}</p>
      ) : null}
      {groups.map((group) => (
        <div key={group.key} className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {t(`groups.${group.key}`)}
          </h3>
          <ul className="flex flex-col">{group.items}</ul>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={onApply} disabled={applying || keep.size === 0}>
          {applying ? (
            <LoaderCircle aria-hidden="true" className="animate-spin" />
          ) : null}
          {t("apply", { count: keep.size })}
        </Button>
        <Button variant="ghost" onClick={onRetry} disabled={applying}>
          <RotateCcw aria-hidden="true" />
          {t("retry")}
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={applying}>
          {t("cancel")}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{t("disclaimer")}</p>
    </div>
  );
}
