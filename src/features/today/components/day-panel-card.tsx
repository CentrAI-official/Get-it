"use client";

import { Check, ChevronRight, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { ProgressRing } from "@/components/progress-ring";
import { ratio } from "../day-plan";
import { openDayPanel, useDayPanel } from "../day-panel-store";

/** Rouvre « Ma journée » depuis le Profil, avec l'avancement du jour. */
export function DayPanelCard() {
  const t = useTranslations("Today.panel");
  const { progress } = useDayPanel();
  const value = progress ? ratio(progress) : 0;
  const complete = progress !== null && progress.total > 0 && value === 1;

  return (
    <button
      type="button"
      onClick={() => openDayPanel()}
      className="-mx-3 flex items-center gap-4 rounded-2xl px-3 py-3 text-left transition-colors outline-none hover:bg-foreground/[0.04] focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <ProgressRing value={value} className="size-12 p-[3px]">
        {complete ? (
          <Check
            aria-hidden="true"
            className="size-5 text-primary"
            strokeWidth={3}
          />
        ) : (
          <Sun aria-hidden="true" className="size-5 text-silver" />
        )}
      </ProgressRing>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-heading text-lg font-bold">{t("button")}</span>
        <span className="text-sm text-muted-foreground">
          {progress && progress.total > 0
            ? t("cardProgress", { done: progress.done, total: progress.total })
            : t("cardDescription")}
        </span>
      </span>
      <ChevronRight
        aria-hidden="true"
        className="size-5 shrink-0 text-muted-foreground"
      />
    </button>
  );
}
