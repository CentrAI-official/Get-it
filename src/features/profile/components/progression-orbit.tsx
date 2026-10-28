import { ChevronRight } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { PercentValue } from "@/components/percent-value";
import { ringBackground } from "@/components/progress-ring";
import { PILLARS, type Pillar } from "@/config/pillars";
import {
  OrbitFrame,
  orbitPosition,
  orbitWidth,
} from "@/features/today/components/orbit-frame";
import { levelFromXp } from "@/features/xp/rules";
import type { RankedLevels } from "@/server/ranked/service";

/** Taille des bulles des piliers, en pixels de la maquette. */
const BUBBLE = 66;

/** Part vers le prochain niveau, arrondie vers le bas : jamais « 100 % » avant de monter. */
const shown = (progress: number) => Math.floor(progress * 100) / 100;

type Bubble = {
  /** Remplissage de l'anneau, de 0 à 1. */
  ring: number;
  value: ReactNode;
  caption: string;
  label: string;
};

/**
 * « Ta progression » dans le design de l'orbite. Sans Ranked : le niveau de
 * l'XP au centre et, pour chaque pilier, le pourcentage fait vers son prochain
 * niveau. En Ranked : le niveau classé au centre et celui de chaque pilier.
 */
export async function ProgressionOrbit({
  total,
  pillars,
  ranked,
}: {
  /** XP totale et XP de chaque pilier. */
  total: number;
  pillars: Record<Pillar, number>;
  ranked: RankedLevels | null;
}) {
  const [t, tPillars, format] = await Promise.all([
    getTranslations("Progress.orbit"),
    getTranslations("Pillars"),
    getFormatter(),
  ]);
  const overall = levelFromXp(total);
  const percent = (part: number) =>
    format.number(shown(part), { style: "percent" });

  const center = ranked
    ? {
        ring: ranked.total / 100,
        level: ranked.total,
        summary: t("centerRanked", { level: ranked.total }),
      }
    : {
        ring: overall.progress,
        level: overall.level,
        summary: t("centerSummary", {
          level: overall.level,
          next: overall.level + 1,
          percent: percent(overall.progress),
        }),
      };

  const bubble = (pillar: Pillar): Bubble => {
    const name = tPillars(`${pillar}.name`);
    // Seuls le physique et le financier sont classés ; le reste suit l'XP
    if (ranked && (pillar === "physical" || pillar === "financial")) {
      const level = ranked[pillar];
      const top = Math.max(1, 100 - level);
      return {
        ring: level / 100,
        value: level,
        caption: t("top", { top }),
        label: t("bubbleRanked", { pillar: name, level, top }),
      };
    }
    const level = levelFromXp(pillars[pillar]);
    return {
      ring: level.progress,
      value: <PercentValue part={shown(level.progress)} />,
      caption: t("levelShort", { level: level.level }),
      label: t("bubble", {
        pillar: name,
        level: level.level,
        next: level.level + 1,
        percent: percent(level.progress),
        xp: pillars[pillar],
      }),
    };
  };

  return (
    <div className="flex flex-col gap-2">
      <OrbitFrame>
        {/* Niveau au centre, l'anneau avance avec lui */}
        <div
          aria-hidden="true"
          className="absolute top-1/2 left-1/2 aspect-square w-[34%] -translate-x-1/2 -translate-y-1/2 rounded-full p-[1.25cqw] motion-safe:animate-pulse-ring"
          style={{ background: ringBackground(center.ring) }}
        >
          <div className="flex size-full flex-col items-center justify-center gap-[0.6cqw] rounded-full bg-card">
            <span className="text-[length:3cqw] tracking-[0.12em] text-muted-foreground uppercase">
              {ranked ? t("rankedLabel") : t("levelLabel")}
            </span>
            <span className="font-display text-[length:10cqw] leading-none">
              {center.level}
            </span>
          </div>
        </div>
        <p className="sr-only">{center.summary}</p>

        {PILLARS.map((pillar) => {
          const data = bubble(pillar);
          return (
            <div
              key={pillar}
              role="img"
              aria-label={data.label}
              className="absolute aspect-square -translate-x-1/2 -translate-y-1/2 rounded-full p-[1.25cqw]"
              style={{
                ...orbitPosition(pillar),
                width: orbitWidth(BUBBLE),
                background: ringBackground(data.ring),
              }}
            >
              <span className="flex size-full items-center justify-center rounded-full orb font-display text-[length:4.6cqw] leading-none text-foreground">
                {data.value}
              </span>
              <span className="absolute top-full left-1/2 mt-[1.5cqw] flex -translate-x-1/2 flex-col items-center leading-tight whitespace-nowrap">
                <span className="text-[length:max(11px,3.4cqw)] font-semibold text-foreground/80">
                  {tPillars(`${pillar}.name`)}
                </span>
                <span className="text-[length:max(10px,3cqw)] text-muted-foreground tabular-nums">
                  {data.caption}
                </span>
              </span>
            </div>
          );
        })}
      </OrbitFrame>

      <details className="group mt-4 text-xs text-muted-foreground">
        <summary className="mx-auto flex w-fit cursor-pointer list-none items-center gap-1 rounded-md outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
          <ChevronRight
            aria-hidden="true"
            className="size-3.5 transition-transform group-open:rotate-90"
          />
          {t("howTitle")}
        </summary>
        <p className="mx-auto mt-2 max-w-sm text-center text-pretty">
          {ranked ? t("howRanked") : t("how")}
        </p>
      </details>
    </div>
  );
}
