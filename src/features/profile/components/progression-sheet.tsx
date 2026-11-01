import { ChevronRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { PILLARS, pillarIcons, type Pillar } from "@/config/pillars";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { Levels } from "@/server/levels/service";

/** Segments de la barre de chaque pilier (10 jours, ou dizaines de niveau). */
export const SHEET_SEGMENTS = 10;

/** Rang affiché d'un niveau classé : « top 27 % » pour le niveau 73. */
const topOf = (level: number) => Math.max(1, 100 - level);

/** Série d'un pilier : jours d'affilée et les 10 derniers jours (actif ou non). */
export type PillarStreak = { days: number; recent: boolean[] };

type PillarCard = {
  /** Coin en haut à droite : « Top 27 % », « Non évalué » ou « Série ». */
  corner: string;
  /** Niveau classé, ou null : la série s'affiche à sa place. */
  level: number | null;
  /** Segments allumés : dizaines du niveau, ou jours actifs récents. */
  segments: boolean[];
  label: string;
};

/**
 * « Ta progression » en fiche de personnage. Le niveau est mesuré (Ranked :
 * le physique et le financier, comparés aux gens de ton âge) ; tant qu'il ne
 * l'est pas, et pour le mental et le social, la carte montre la série du
 * pilier.
 */
export async function ProgressionSheet({
  levels,
  streaks,
}: {
  /** Niveaux mesurés (Mes niveaux), et si la personne est en Ranked. */
  levels: Levels;
  streaks: Record<Pillar, PillarStreak>;
}) {
  const [t, tPillars] = await Promise.all([
    getTranslations("Progress.sheet"),
    getTranslations("Pillars"),
  ]);
  const { total } = levels;

  const card = (pillar: Pillar): PillarCard => {
    const name = tPillars(`${pillar}.name`);
    const measured = pillar === "physical" || pillar === "financial";
    const level = measured ? levels[pillar] : null;
    if (level !== null) {
      return {
        corner: t("rankedTop", { top: topOf(level) }),
        level,
        segments: Array.from(
          { length: SHEET_SEGMENTS },
          (_, index) => index < Math.floor((level / 100) * SHEET_SEGMENTS),
        ),
        label: t("bubbleRanked", { pillar: name, level, top: topOf(level) }),
      };
    }
    const streak = streaks[pillar];
    return {
      corner: measured ? t("notEvaluated") : t("streakCorner"),
      level: null,
      segments: streak.recent,
      label: t("streakLabel", {
        pillar: name,
        count: streak.days,
        active: streak.recent.filter(Boolean).length,
      }),
    };
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4 rounded-3xl border border-foreground/6 bg-raised p-5">
        <p
          className={cn(
            "flex size-21 shrink-0 flex-col items-center justify-center rounded-[22px]",
            total !== null
              ? "bg-primary text-primary-foreground"
              : "bg-foreground/8 text-muted-foreground",
          )}
        >
          <span className="text-[10px] font-bold tracking-[0.14em] uppercase">
            {levels.ranked && total !== null
              ? t("rankedLabel")
              : t("levelLabel")}
          </span>
          <span className="font-display text-[44px] leading-none">
            {total ?? "—"}
          </span>
        </p>
        {total !== null ? (
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <p className="font-semibold tabular-nums">
              {t("rankedTop", { top: topOf(total) })}
            </p>
            <div
              role="img"
              aria-label={t("rankedSummary", {
                level: total,
                top: topOf(total),
              })}
              className="h-2 overflow-hidden rounded-full bg-foreground/8"
            >
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${total}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">{t("rankedDetail")}</p>
            <Link
              href="/profile/ranked"
              className="w-fit rounded-md text-xs font-semibold text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {t("seeLevels")}
            </Link>
          </div>
        ) : (
          <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
            <p className="font-semibold">{t("notEvaluatedTitle")}</p>
            <p className="text-xs text-pretty text-muted-foreground">
              {t("notEvaluatedBody")}
            </p>
            <Button asChild size="sm">
              <Link href="/profile/ranked">{t("evaluate")}</Link>
            </Button>
          </div>
        )}
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
                  className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/14 text-primary"
                >
                  <Icon className="size-[18px]" />
                </span>
                <span className="text-right text-[13px] leading-tight font-semibold text-muted-foreground tabular-nums">
                  {data.corner}
                </span>
              </div>
              <p className="flex flex-col gap-0.5">
                <span className="text-[13px] text-muted-foreground">
                  {tPillars(`${pillar}.name`)}
                </span>
                {data.level !== null ? (
                  <span className="font-display text-4xl leading-none">
                    {t("pillarLevel", { level: data.level })}
                  </span>
                ) : (
                  <span className="flex items-baseline gap-1.5">
                    <span className="font-display text-4xl leading-none tabular-nums">
                      {streaks[pillar].days}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {t("streakUnit", { count: streaks[pillar].days })}
                    </span>
                  </span>
                )}
              </p>
              <div
                role="img"
                aria-label={data.label}
                className="grid grid-cols-10 gap-[3px]"
              >
                {data.segments.map((on, index) => (
                  <span
                    key={index}
                    className={cn(
                      "h-2 rounded-[3px]",
                      on ? "bg-primary" : "bg-foreground/8",
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
        <p className="mt-2 max-w-prose text-pretty">{t("how")}</p>
      </details>
    </div>
  );
}
