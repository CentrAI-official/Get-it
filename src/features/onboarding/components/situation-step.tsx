"use client";

import { useTranslations } from "next-intl";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { pillarIcons } from "@/config/pillars";
import { ASSESSMENT_LEVELS } from "../schemas";
import type { StepProps } from "./step-props";

export function SituationStep({ draft, update }: StepProps) {
  const t = useTranslations("Onboarding.situation");
  const tPillars = useTranslations("Pillars");
  // Bornes de l'échelle, rappelées sous chaque pilier
  const [first, , , , last] = ASSESSMENT_LEVELS;

  return (
    <div className="flex flex-col gap-4">
      {draft.pillars.map((pillar) => {
        const Icon = pillarIcons[pillar];
        const headingId = `situation-${pillar}`;
        const current = ASSESSMENT_LEVELS.find(
          (level) => level.score === draft.assessments[pillar],
        );
        return (
          <section
            key={pillar}
            aria-labelledby={headingId}
            className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2
                id={headingId}
                className="flex items-center gap-2 font-medium"
              >
                <Icon aria-hidden="true" className="size-4 text-silver" />
                {tPillars(`${pillar}.name`)}
              </h2>
              {current ? (
                <p className="text-sm text-muted-foreground">
                  {t(`levels.${current.key}`)}
                </p>
              ) : null}
            </div>
            <RadioGroupPrimitive.Root
              aria-labelledby={headingId}
              orientation="horizontal"
              value={draft.assessments[pillar]?.toString() ?? ""}
              onValueChange={(value) =>
                update({
                  assessments: {
                    ...draft.assessments,
                    [pillar]: Number(value),
                  },
                })
              }
              className="grid grid-cols-5 gap-2"
            >
              {ASSESSMENT_LEVELS.map((level) => (
                <RadioGroupPrimitive.Item
                  key={level.score}
                  value={level.score.toString()}
                  aria-label={t("scoreLabel", {
                    score: level.score,
                    level: t(`levels.${level.key}`),
                  })}
                  className="h-11 rounded-xl border border-white/10 bg-white/[0.03] font-mono text-base font-bold text-muted-foreground transition-colors outline-none hover:bg-white/[0.08] hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 data-checked:border-primary data-checked:bg-primary/15 data-checked:text-foreground"
                >
                  {level.score}
                </RadioGroupPrimitive.Item>
              ))}
            </RadioGroupPrimitive.Root>
            <div
              aria-hidden="true"
              className="flex justify-between gap-4 text-xs text-muted-foreground"
            >
              <span>{t(`levels.${first.key}`)}</span>
              <span className="text-right">{t(`levels.${last.key}`)}</span>
            </div>
          </section>
        );
      })}
    </div>
  );
}
