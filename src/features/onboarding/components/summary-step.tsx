"use client";

import { Pencil } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { pillarIcons } from "@/config/pillars";
import {
  ASSESSMENT_LEVELS,
  DAILY_MINUTES_OPTIONS,
  type OnboardingDraft,
} from "../schemas";
import type { OnboardingStep } from "./steps";

type SummaryStepProps = {
  draft: OnboardingDraft;
  onEdit: (step: OnboardingStep) => void;
};

export function SummaryStep({ draft, onEdit }: SummaryStepProps) {
  const t = useTranslations("Onboarding");
  const tPillars = useTranslations("Pillars");
  const format = useFormatter();
  const time = DAILY_MINUTES_OPTIONS.find(
    (option) => option.minutes === draft.dailyMinutes,
  );

  const rows: { step: OnboardingStep; label: string; value: ReactNode }[] = [
    {
      step: "about",
      label: t("summary.name"),
      value: draft.displayName.trim(),
    },
    {
      step: "about",
      label: t("summary.occupation"),
      value: draft.occupation
        ? t(`about.occupations.${draft.occupation}`)
        : t("summary.notProvided"),
    },
    {
      step: "pillars",
      label: t("summary.pillars"),
      value: format.list(
        draft.pillars.map((pillar) => tPillars(`${pillar}.name`)),
        { type: "conjunction" },
      ),
    },
    {
      step: "goals",
      label: t("summary.goals"),
      value: (
        <ul className="flex flex-col gap-1.5">
          {draft.goals.map((goal) => {
            const Icon = pillarIcons[goal.pillar];
            return (
              <li key={goal.title} className="flex items-start gap-2">
                <Icon
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 text-silver"
                />
                <span className="break-words">{goal.title}</span>
              </li>
            );
          })}
        </ul>
      ),
    },
    {
      step: "situation",
      label: t("summary.assessments"),
      value: (
        <ul className="flex flex-col gap-1.5">
          {draft.pillars.map((pillar) => {
            const level = ASSESSMENT_LEVELS.find(
              (item) => item.score === draft.assessments[pillar],
            );
            return (
              <li key={pillar}>
                {tPillars(`${pillar}.name`)}
                {level ? (
                  <span className="text-muted-foreground">
                    {" · "}
                    {t(`situation.levels.${level.key}`)}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      ),
    },
    {
      step: "time",
      label: t("summary.time"),
      value: time ? t(`time.options.${time.key}`) : t("summary.notProvided"),
    },
  ];

  return (
    <dl className="flex flex-col divide-y divide-white/5 rounded-2xl border border-white/10 bg-white/[0.03]">
      {rows.map((row) => (
        <div
          key={row.label}
          className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 px-4 py-3 sm:grid-cols-[10rem_1fr_auto]"
        >
          <dt className="text-sm text-muted-foreground sm:pt-0.5">
            {row.label}
          </dt>
          <dd className="col-span-2 row-start-2 min-w-0 sm:col-span-1 sm:col-start-2 sm:row-start-1">
            {row.value}
          </dd>
          <div className="col-start-2 row-start-1 sm:col-start-3">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t("summary.edit", { section: row.label })}
              onClick={() => onEdit(row.step)}
            >
              <Pencil aria-hidden="true" />
            </Button>
          </div>
        </div>
      ))}
    </dl>
  );
}
