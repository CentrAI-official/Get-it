import { ChevronRight } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { PercentValue } from "@/components/percent-value";
import { ringBackground } from "@/components/progress-ring";
import { PILLARS, type Pillar } from "@/config/pillars";
import {
  OrbitFrame,
  orbitPosition,
  orbitWidth,
} from "@/features/today/components/orbit-frame";
import { levelFromXp } from "@/features/xp/rules";

/** Taille des bulles des piliers, en pixels de la maquette. */
const BUBBLE = 66;

/** Part vers le prochain niveau, arrondie vers le bas : jamais « 100 % » avant de monter. */
const shown = (progress: number) => Math.floor(progress * 100) / 100;

/**
 * « Ta progression » dans le design de l'orbite : ton niveau au centre, et pour
 * chaque pilier le pourcentage fait vers son prochain niveau (l'anneau aussi).
 */
export async function ProgressionOrbit({
  total,
  pillars,
}: {
  /** XP totale et XP de chaque pilier. */
  total: number;
  pillars: Record<Pillar, number>;
}) {
  const [t, tPillars, format] = await Promise.all([
    getTranslations("Progress.orbit"),
    getTranslations("Pillars"),
    getFormatter(),
  ]);
  const overall = levelFromXp(total);
  const percent = (part: number) =>
    format.number(shown(part), { style: "percent" });

  return (
    <div className="flex flex-col gap-2">
      <OrbitFrame>
        {/* Niveau global au centre, l'anneau avance vers le suivant */}
        <div
          aria-hidden="true"
          className="absolute top-1/2 left-1/2 aspect-square w-[34%] -translate-x-1/2 -translate-y-1/2 rounded-full p-[1.25cqw] motion-safe:animate-pulse-ring"
          style={{ background: ringBackground(overall.progress) }}
        >
          <div className="flex size-full flex-col items-center justify-center gap-[0.6cqw] rounded-full bg-card">
            <span className="text-[length:3cqw] tracking-[0.12em] text-muted-foreground uppercase">
              {t("levelLabel")}
            </span>
            <span className="font-mono text-[length:10cqw] leading-none font-bold">
              {overall.level}
            </span>
          </div>
        </div>
        <p className="sr-only">
          {t("centerSummary", {
            level: overall.level,
            next: overall.level + 1,
            percent: percent(overall.progress),
          })}
        </p>

        {PILLARS.map((pillar) => {
          const level = levelFromXp(pillars[pillar]);
          const name = tPillars(`${pillar}.name`);
          return (
            <div
              key={pillar}
              role="img"
              aria-label={t("bubble", {
                pillar: name,
                level: level.level,
                next: level.level + 1,
                percent: percent(level.progress),
                xp: pillars[pillar],
              })}
              className="absolute aspect-square -translate-x-1/2 -translate-y-1/2 rounded-full p-[1.25cqw]"
              style={{
                ...orbitPosition(pillar),
                width: orbitWidth(BUBBLE),
                background: ringBackground(level.progress),
              }}
            >
              <span className="flex size-full items-center justify-center rounded-full orb font-mono text-[length:4.6cqw] leading-none font-bold text-foreground">
                <PercentValue part={shown(level.progress)} />
              </span>
              <span className="absolute top-full left-1/2 mt-[1.5cqw] flex -translate-x-1/2 flex-col items-center leading-tight whitespace-nowrap">
                <span className="text-[length:max(11px,3.4cqw)] font-semibold text-foreground/80">
                  {name}
                </span>
                <span className="font-mono text-[length:max(10px,3cqw)] text-muted-foreground">
                  {t("levelShort", { level: level.level })}
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
          {t("how")}
        </p>
      </details>
    </div>
  );
}
