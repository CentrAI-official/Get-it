import { ChevronRight } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { PILLARS, pillarIcons, type Pillar } from "@/config/pillars";
import { levelFromXp, totalXpForLevel } from "@/features/xp/rules";
import { cn } from "@/lib/utils";
import type { RankedLevels } from "@/server/ranked/service";

/** Segments de la barre de chaque pilier. */
const SEGMENTS = 10;

/** Part vers le prochain niveau, arrondie vers le bas : jamais « 100 % » avant de monter. */
const shown = (progress: number) => Math.floor(progress * 100) / 100;

/** Rang affiché d'un niveau classé : « top 27 % » pour le niveau 73. */
const topOf = (level: number) => Math.max(1, 100 - level);

type PillarCard = {
  /** Coin en haut à droite : pourcentage fait, ou « Top 27 % » en Ranked. */
  corner: string;
  level: number;
  /** Segments remplis, de 0 à SEGMENTS. */
  filled: number;
  label: string;
};

/**
 * « Ta progression » en fiche de personnage : le niveau global en carte, puis
 * une carte par pilier (niveau et segments vers le suivant). En Ranked, le
 * niveau classé remplace celui de l'XP en haut, et pour le physique et le
 * financier.
 */
export async function ProgressionSheet({
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
    getTranslations("Progress.sheet"),
    getTranslations("Pillars"),
    getFormatter(),
  ]);
  const percent = (part: number) =>
    format.number(shown(part), { style: "percent" });

  const overall = levelFromXp(total);
  const head = ranked
    ? {
        label: t("rankedLabel"),
        level: ranked.total,
        progress: ranked.total / 100,
        headline: t("rankedTop", { top: topOf(ranked.total) }),
        detail: t("rankedDetail"),
        summary: t("rankedSummary", {
          level: ranked.total,
          top: topOf(ranked.total),
        }),
      }
    : {
        label: t("levelLabel"),
        level: overall.level,
        progress: overall.progress,
        headline: t("toNext", { xp: overall.needed - overall.current }),
        detail: t("toNextDetail", {
          xp: total,
          needed: totalXpForLevel(overall.level + 1),
          level: overall.level + 1,
        }),
        summary: t("levelSummary", {
          level: overall.level,
          xp: total,
          needed: totalXpForLevel(overall.level + 1),
          next: overall.level + 1,
        }),
      };

  const card = (pillar: Pillar): PillarCard => {
    const name = tPillars(`${pillar}.name`);
    // Seuls le physique et le financier sont classés ; le reste suit l'XP
    if (ranked && (pillar === "physical" || pillar === "financial")) {
      const level = ranked[pillar];
      return {
        corner: t("rankedTop", { top: topOf(level) }),
        level,
        filled: Math.floor((level / 100) * SEGMENTS),
        label: t("bubbleRanked", { pillar: name, level, top: topOf(level) }),
      };
    }
    const level = levelFromXp(pillars[pillar]);
    return {
      corner: percent(level.progress),
      level: level.level,
      filled: Math.floor(shown(level.progress) * SEGMENTS),
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
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4 rounded-3xl border border-foreground/6 bg-raised p-5">
        <p className="flex size-21 shrink-0 flex-col items-center justify-center rounded-[22px] bg-primary text-primary-foreground">
          <span className="text-[10px] font-bold tracking-[0.14em] uppercase">
            {head.label}
          </span>
          <span className="font-display text-[44px] leading-none">
            {head.level}
          </span>
        </p>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="font-semibold tabular-nums">{head.headline}</p>
          <div
            role="img"
            aria-label={head.summary}
            className="h-2 overflow-hidden rounded-full bg-foreground/8"
          >
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.round(shown(head.progress) * 100)}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground tabular-nums">
            {head.detail}
          </p>
        </div>
      </div>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {PILLARS.map((pillar) => {
          const data = card(pillar);
          const Icon = pillarIcons[pillar];
          return (
            <li
              key={pillar}
              className="flex flex-col gap-3 rounded-[20px] border border-foreground/6 bg-raised p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  aria-hidden="true"
                  className="flex size-9 items-center justify-center rounded-xl bg-primary/14 text-primary"
                >
                  <Icon className="size-[18px]" />
                </span>
                <span className="text-[13px] font-semibold text-muted-foreground tabular-nums">
                  {data.corner}
                </span>
              </div>
              <p className="flex flex-col gap-0.5">
                <span className="text-[13px] text-muted-foreground">
                  {tPillars(`${pillar}.name`)}
                </span>
                <span className="font-display text-4xl leading-none">
                  {t("pillarLevel", { level: data.level })}
                </span>
              </p>
              <div
                role="img"
                aria-label={data.label}
                className="grid grid-cols-10 gap-[3px]"
              >
                {Array.from({ length: SEGMENTS }, (_, index) => (
                  <span
                    key={index}
                    className={cn(
                      "h-2 rounded-[3px]",
                      index < data.filled ? "bg-primary" : "bg-foreground/8",
                    )}
                  />
                ))}
              </div>
            </li>
          );
        })}
      </ul>

      <details className="group mt-1 text-xs text-muted-foreground">
        <summary className="flex w-fit cursor-pointer list-none items-center gap-1 rounded-md outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
          <ChevronRight
            aria-hidden="true"
            className="size-3.5 transition-transform group-open:rotate-90"
          />
          {t("howTitle")}
        </summary>
        <p className="mt-2 max-w-prose text-pretty">
          {ranked ? t("howRanked") : t("how")}
        </p>
      </details>
    </div>
  );
}
