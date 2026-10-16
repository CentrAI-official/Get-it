"use client";

import { ChevronRight } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { PercentValue } from "@/components/percent-value";
import { ringBackground } from "@/components/progress-ring";
import { PILLARS, type Pillar } from "@/config/pillars";
import { cn } from "@/lib/utils";
import { ratio, type Progress } from "../day-plan";

// Géométrie de la maquette (322 × 300), en pourcentages : l'orbite suit la largeur disponible
const BOX = { width: 322, height: 300 };
const CENTER = { x: 161, y: 150 };
const RADIUS = 112;
/** Position de chaque bulle sur l'orbite, en degrés (0 à droite, sens horaire). */
const ANGLES: Record<Pillar, number> = {
  physical: -135,
  mental: -45,
  financial: 45,
  social: 135,
};

const toX = (px: number) => `${(px / BOX.width) * 100}%`;
const toY = (px: number) => `${(px / BOX.height) * 100}%`;

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
        "flex flex-col gap-2 rounded-3xl glass p-4 sm:p-5",
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

      <div className="@container relative mx-auto aspect-[322/300] w-full max-w-[380px]">
        <svg
          viewBox={`0 0 ${BOX.width} ${BOX.height}`}
          aria-hidden="true"
          className="absolute inset-0 size-full"
        >
          <circle
            cx={CENTER.x}
            cy={CENTER.y}
            r={RADIUS}
            fill="none"
            stroke="rgb(255 255 255 / 0.1)"
            strokeDasharray="3 6"
          />
          <circle
            cx={CENTER.x}
            cy={CENTER.y}
            r={70}
            fill="none"
            className="stroke-primary/20"
          />
        </svg>

        {/* Satellite qui fait le tour de l'orbite */}
        <div
          aria-hidden="true"
          className="absolute motion-safe:animate-orbit"
          style={{
            left: toX(CENTER.x - RADIUS),
            top: toY(CENTER.y - RADIUS),
            width: toX(RADIUS * 2),
            height: toY(RADIUS * 2),
          }}
        >
          <span className="absolute top-0 left-1/2 size-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_10px_var(--primary)]" />
        </div>

        {/* Avancement de la journée */}
        <div
          aria-hidden="true"
          className="absolute top-1/2 left-1/2 aspect-square w-[34%] -translate-x-1/2 -translate-y-1/2 rounded-full p-[1.25cqw] motion-safe:animate-pulse-ring"
          style={{ background: ringBackground(ratio(day)) }}
        >
          <div className="flex size-full flex-col items-center justify-center gap-[0.6cqw] rounded-full bg-card">
            <span className="font-mono text-[length:8.6cqw] leading-none font-bold">
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
          const angle = (ANGLES[pillar] * Math.PI) / 180;

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
                left: toX(CENTER.x + RADIUS * Math.cos(angle)),
                top: toY(CENTER.y + RADIUS * Math.sin(angle)),
                width: toX(size),
                background: ringBackground(ratio(progress)),
              }}
            >
              <span
                className={cn(
                  "flex size-full items-center justify-center rounded-full font-mono text-[length:4.6cqw] leading-none font-bold text-foreground",
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
      </div>

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
