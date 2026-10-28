"use client";

import { ChevronRight } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { PercentValue } from "@/components/percent-value";
import { ringBackground } from "@/components/progress-ring";
import { PILLARS, type Pillar } from "@/config/pillars";
import { cn } from "@/lib/utils";
import { ratio, type Progress } from "../day-plan";
import { OrbitFrame, orbitPosition, orbitWidth } from "./orbit-frame";

type SystemOrbitProps = {
  /** Score de chaque pilier, de 0 à 100 ; null tant qu'il n'y a pas de données. */
  scores: Record<Pillar, number | null>;
  day: Progress;
  pillars: Record<Pillar, Progress>;
  filter: Pillar | null;
  /** Toucher une bulle filtre les quêtes ; sans cette fonction, l'orbite est un simple affichage. */
  onFilterChange?: (pillar: Pillar | null) => void;
  /** Affiche l'explication du calcul du score (masquée dans l'aperçu du site). */
  explain?: boolean;
  className?: string;
};

/**
 * « Ton système » : l'avancement du jour au centre et les quatre piliers en
 * orbite. Chaque bulle affiche le score du pilier, son anneau ce qui est fait
 * aujourd'hui ; la toucher filtre les quêtes (si `onFilterChange` est fourni).
 */
export function SystemOrbit({
  scores,
  day,
  pillars,
  filter,
  onFilterChange,
  explain = true,
  className,
}: SystemOrbitProps) {
  const t = useTranslations("Today.system");
  const tPillars = useTranslations("Pillars");
  const format = useFormatter();
  const percent = (part: number) => format.number(part, { style: "percent" });

  return (
    <section
      aria-labelledby="system-title"
      className={cn(
        "flex flex-col gap-2 border-t border-foreground/8 pt-6",
        className,
      )}
    >
      <div className="flex min-h-8 items-center justify-between gap-3">
        <h2 id="system-title" className="font-heading font-semibold">
          {t("title")}
        </h2>
        {filter && onFilterChange ? (
          <button
            type="button"
            onClick={() => onFilterChange(null)}
            className="h-8 rounded-full border border-primary/40 bg-primary/15 px-3 text-xs font-medium text-primary transition-colors outline-none hover:bg-primary/25 focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {t("clearFilter", { pillar: tPillars(`${filter}.name`) })}
          </button>
        ) : null}
      </div>

      <OrbitFrame>
        {/* Avancement de la journée */}
        <div
          aria-hidden="true"
          className="absolute top-1/2 left-1/2 aspect-square w-[34%] -translate-x-1/2 -translate-y-1/2 rounded-full p-[1.25cqw] motion-safe:animate-pulse-ring"
          style={{ background: ringBackground(ratio(day)) }}
        >
          <div className="flex size-full flex-col items-center justify-center gap-[0.6cqw] rounded-full bg-card">
            <span className="font-display text-[length:8.6cqw] leading-none">
              {day.total > 0 ? <PercentValue part={ratio(day)} /> : "—"}
            </span>
            <span className="text-[length:3cqw] tracking-[0.12em] text-muted-foreground uppercase">
              {t("dayLabel")}
            </span>
          </div>
        </div>
        <p className="sr-only">{t("daySummary", day)}</p>

        {PILLARS.map((pillar) => {
          const score = scores[pillar];
          const progress = pillars[pillar];
          const selected = filter === pillar;
          const name = tPillars(`${pillar}.name`);
          // Plus le score est haut, plus la bulle est grosse
          const size = 46 + (score ?? 40) * 0.3;

          const label = t("bubble", {
            pillar: name,
            score: score === null ? t("noScore") : percent(score / 100),
            done: progress.done,
            total: progress.total,
          });
          const Bubble = onFilterChange ? "button" : "div";

          return (
            <Bubble
              key={pillar}
              {...(onFilterChange
                ? {
                    type: "button" as const,
                    "aria-pressed": selected,
                    onClick: () => onFilterChange(selected ? null : pillar),
                  }
                : { role: "img" })}
              aria-label={label}
              className={cn(
                "absolute aspect-square -translate-x-1/2 -translate-y-1/2 rounded-full p-[1.25cqw] transition-[scale,box-shadow] duration-300 ease-out outline-none focus-visible:ring-3 focus-visible:ring-ring/60",
                selected
                  ? "scale-[1.14] shadow-[0_0_30px_color-mix(in_oklch,var(--primary)_60%,transparent)]"
                  : "hover:scale-105",
              )}
              style={{
                ...orbitPosition(pillar),
                width: orbitWidth(size),
                background: ringBackground(ratio(progress)),
              }}
            >
              <span
                className={cn(
                  "flex size-full items-center justify-center rounded-full font-display text-[length:4.6cqw] leading-none text-foreground",
                  selected ? "orb-active" : "orb",
                )}
              >
                {score === null ? "—" : <PercentValue part={score / 100} />}
              </span>
              <span
                className={cn(
                  "absolute top-full left-1/2 mt-[1.5cqw] -translate-x-1/2 text-[length:max(11px,3.4cqw)] font-semibold whitespace-nowrap",
                  selected ? "text-primary" : "text-foreground/80",
                )}
              >
                {name}
              </span>
            </Bubble>
          );
        })}
      </OrbitFrame>

      {onFilterChange ? (
        <p className="text-center text-xs text-muted-foreground">{t("hint")}</p>
      ) : null}
      {explain ? (
        <details className="group text-xs text-muted-foreground">
          <summary className="mx-auto flex w-fit cursor-pointer list-none items-center gap-1 rounded-md outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
            <ChevronRight
              aria-hidden="true"
              className="size-3.5 transition-transform group-open:rotate-90"
            />
            {t("howTitle")}
          </summary>
          <p className="mx-auto mt-2 max-w-sm text-center text-pretty">
            {t("how")}
          </p>
        </details>
      ) : null}
    </section>
  );
}
