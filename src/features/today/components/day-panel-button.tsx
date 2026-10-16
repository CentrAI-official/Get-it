"use client";

import { Check, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { ProgressRing } from "@/components/progress-ring";
import { cn } from "@/lib/utils";
import { ratio } from "../day-plan";
import { openDayPanel, useDayPanel } from "../day-panel-store";

/**
 * Ouvre « Ma journée ». `sidebar` : ligne pleine largeur avec le compte du jour ;
 * `icon` : bouton rond de la barre du haut (mobile).
 */
export function DayPanelButton({ variant }: { variant: "sidebar" | "icon" }) {
  const t = useTranslations("Today.panel");
  const { progress } = useDayPanel();
  const value = progress ? ratio(progress) : 0;
  const complete = progress !== null && progress.total > 0 && value === 1;
  const label = progress
    ? t("buttonLabel", { done: progress.done, total: progress.total })
    : t("button");

  const ring = (
    <ProgressRing
      value={value}
      className={variant === "icon" ? "size-8 p-[2.5px]" : "size-7 p-[2.5px]"}
    >
      {complete ? (
        <Check className="size-3.5 text-primary" strokeWidth={3} />
      ) : (
        <Sun className="size-3.5 text-silver" />
      )}
    </ProgressRing>
  );

  if (variant === "icon") {
    return (
      <button
        type="button"
        aria-label={label}
        onClick={() => openDayPanel()}
        className="flex size-10 items-center justify-center rounded-full outline-none hover:bg-white/5 focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {ring}
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => openDayPanel()}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm font-medium transition-colors outline-none hover:bg-white/[0.06] focus-visible:ring-3 focus-visible:ring-ring/50",
      )}
    >
      {ring}
      <span className="flex-1 text-left">{t("button")}</span>
      {progress && progress.total > 0 ? (
        <span
          aria-hidden="true"
          className="font-mono text-xs text-muted-foreground"
        >
          {t("count", { done: progress.done, total: progress.total })}
        </span>
      ) : null}
    </button>
  );
}
