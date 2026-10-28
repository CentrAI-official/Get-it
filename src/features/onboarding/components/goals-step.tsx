"use client";

import { Check, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { pillarIcons, type Pillar } from "@/config/pillars";
import { ACTIVE_GOALS_PER_PILLAR } from "@/features/goals/schemas";
import { cn } from "@/lib/utils";
import {
  GOAL_SUGGESTIONS,
  GOAL_TITLE_MAX_LENGTH,
  GOAL_TITLE_MIN_LENGTH,
  MAX_GOALS,
} from "../schemas";
import type { StepProps } from "./step-props";

type SuggestionKey = {
  [P in Pillar]: `${P}.${(typeof GOAL_SUGGESTIONS)[P][number]}`;
}[Pillar];

/** Clés de traduction des idées d'objectifs d'un pilier. */
function suggestionKeys(pillar: Pillar) {
  return GOAL_SUGGESTIONS[pillar].map(
    (key) => `${pillar}.${key}` as SuggestionKey,
  );
}

const sameTitle = (a: string, b: string) =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

export function GoalsStep({ draft, update }: StepProps) {
  const t = useTranslations("Onboarding.goals");
  const tPillars = useTranslations("Pillars");
  const [customTitle, setCustomTitle] = useState("");
  const [customPillar, setCustomPillar] = useState<Pillar | null>(null);

  const isFull = draft.goals.length >= MAX_GOALS;
  // 3 objectifs en cours au plus par aspect
  const pillarFull = (pillar: Pillar) =>
    draft.goals.filter((goal) => goal.pillar === pillar).length >=
    ACTIVE_GOALS_PER_PILLAR;
  const hasGoal = (title: string) =>
    draft.goals.some((goal) => sameTitle(goal.title, title));
  // Pilier de l'objectif personnalisé : le premier choisi, sauf choix contraire
  const selectedPillar =
    customPillar && draft.pillars.includes(customPillar)
      ? customPillar
      : draft.pillars[0];
  const canAddCustom =
    !isFull &&
    selectedPillar !== undefined &&
    !pillarFull(selectedPillar) &&
    customTitle.trim().length >= GOAL_TITLE_MIN_LENGTH &&
    !hasGoal(customTitle);

  function toggleGoal(title: string, pillar: Pillar) {
    update({
      goals: hasGoal(title)
        ? draft.goals.filter((goal) => !sameTitle(goal.title, title))
        : [...draft.goals, { title, pillar }],
    });
  }

  function addCustomGoal() {
    if (!canAddCustom || !selectedPillar) return;
    update({
      goals: [
        ...draft.goals,
        { title: customTitle.trim(), pillar: selectedPillar },
      ],
    });
    setCustomTitle("");
  }

  // Entrée ajoute l'objectif au lieu de passer à l'étape suivante
  function handleCustomKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      addCustomGoal();
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {draft.pillars.map((pillar) => {
        const Icon = pillarIcons[pillar];
        const headingId = `goals-${pillar}`;
        return (
          <section
            key={pillar}
            aria-labelledby={headingId}
            className="flex flex-col gap-3"
          >
            <h2
              id={headingId}
              className="flex items-center gap-2 text-sm font-medium"
            >
              <Icon aria-hidden="true" className="size-4 text-silver" />
              {tPillars(`${pillar}.name`)}
            </h2>
            <ul className="flex flex-wrap gap-2">
              {suggestionKeys(pillar).map((key) => {
                const title = t(`suggestions.${key}`);
                const selected = hasGoal(title);
                return (
                  <li key={key}>
                    <Button
                      type="button"
                      variant="outline"
                      aria-pressed={selected}
                      disabled={!selected && (isFull || pillarFull(pillar))}
                      onClick={() => toggleGoal(title, pillar)}
                      className="h-auto min-h-9 py-2 text-left whitespace-normal aria-pressed:border-primary aria-pressed:bg-primary/10 aria-pressed:text-foreground dark:aria-pressed:border-primary dark:aria-pressed:bg-primary/10"
                    >
                      {selected ? (
                        <Check aria-hidden="true" className="text-primary" />
                      ) : (
                        <Plus aria-hidden="true" />
                      )}
                      {title}
                    </Button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      <section aria-labelledby="goals-custom" className="flex flex-col gap-3">
        <h2 id="goals-custom" className="text-sm font-medium">
          {t("customTitle")}
        </h2>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field className="flex-1">
            <FieldLabel htmlFor="goal-custom-title" className="sr-only">
              {t("customLabel")}
            </FieldLabel>
            <Input
              id="goal-custom-title"
              value={customTitle}
              onChange={(event) => setCustomTitle(event.target.value)}
              onKeyDown={handleCustomKeyDown}
              placeholder={t("customPlaceholder")}
              maxLength={GOAL_TITLE_MAX_LENGTH}
              disabled={isFull}
              className="h-10"
            />
          </Field>
          {draft.pillars.length > 1 ? (
            <Field className="sm:w-44">
              <FieldLabel htmlFor="goal-custom-pillar" className="sr-only">
                {t("customPillar")}
              </FieldLabel>
              <select
                id="goal-custom-pillar"
                value={selectedPillar}
                onChange={(event) =>
                  setCustomPillar(
                    draft.pillars.find(
                      (pillar) => pillar === event.target.value,
                    ) ?? null,
                  )
                }
                disabled={isFull}
                className="h-10 w-full rounded-lg border border-input bg-input/30 px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
              >
                {draft.pillars.map((pillar) => (
                  <option key={pillar} value={pillar}>
                    {tPillars(`${pillar}.name`)}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            onClick={addCustomGoal}
            disabled={!canAddCustom}
            className="h-10"
          >
            <Plus aria-hidden="true" />
            {t("add")}
          </Button>
        </div>
      </section>

      <section aria-labelledby="goals-chosen" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="goals-chosen" className="text-sm font-medium">
            {t("chosenTitle")}
          </h2>
          <p
            aria-live="polite"
            className={cn(
              "text-sm text-muted-foreground",
              isFull && "text-foreground",
            )}
          >
            {t("count", { count: draft.goals.length, max: MAX_GOALS })}
          </p>
        </div>
        {draft.goals.length > 0 ? (
          <ul className="flex flex-col">
            {draft.goals.map((goal) => {
              const Icon = pillarIcons[goal.pillar];
              return (
                <li
                  key={goal.title}
                  className="flex items-center gap-3 border-b border-foreground/8 py-2"
                >
                  <Icon
                    aria-hidden="true"
                    className="size-4 shrink-0 text-silver"
                  />
                  <span className="min-w-0 flex-1 text-sm break-words">
                    {goal.title}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("remove", { title: goal.title })}
                    onClick={() => toggleGoal(goal.title, goal.pillar)}
                  >
                    <X aria-hidden="true" />
                  </Button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
