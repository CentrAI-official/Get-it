"use client";

import { Flame } from "lucide-react";
import { useTranslations } from "next-intl";
import { Progress } from "@/components/ui/progress";
import type { LevelProgress } from "@/features/xp/rules";
import { cn } from "@/lib/utils";

type DayTilesProps = {
  /** Meilleure série en cours, toutes habitudes confondues. */
  streak: number;
  /** Niveau actuel et avancement vers le suivant. */
  level: LevelProgress;
  className?: string;
};

const tile =
  "flex min-w-0 rounded-2xl border border-white/8 bg-white/[0.035] p-3.5";

/** « En bref » : la série en cours et le chemin vers le prochain niveau. */
export function DayTiles({ streak, level, className }: DayTilesProps) {
  const t = useTranslations("Today.tiles");
  const tXp = useTranslations("Xp");
  const left = level.needed - level.current;
  const next = level.level + 1;

  return (
    <section
      aria-label={t("label")}
      className={cn("grid grid-cols-2 gap-3", className)}
    >
      <div className={cn(tile, "items-center gap-3")}>
        <Flame
          aria-hidden="true"
          className={cn(
            "size-7 shrink-0",
            streak > 0 ? "text-primary" : "text-muted-foreground",
          )}
        />
        <div className="flex min-w-0 flex-col">
          <span className="font-mono text-xl font-bold">
            {t("streak", { count: streak })}
          </span>
          <span className="text-xs text-muted-foreground">
            {t("streakLabel")}
          </span>
        </div>
      </div>

      <div className={cn(tile, "flex-col justify-center gap-2")}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-2">
          <span className="text-xs text-muted-foreground">
            {tXp("toLevel", { level: next })}
          </span>
          <span className="font-mono text-xs font-bold text-primary">
            {tXp("xp", { xp: left })}
          </span>
        </div>
        <Progress
          value={Math.round(level.progress * 100)}
          aria-label={tXp("toLevelLabel", { xp: left, level: next })}
        />
      </div>
    </section>
  );
}
