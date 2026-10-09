"use client";

import { Flame, Zap } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

type DayTilesProps = {
  /** Meilleure série en cours, toutes habitudes confondues. */
  streak: number;
  /** Énergie du check-in du jour (1 à 5), ou null s'il n'est pas fait. */
  energy: number | null;
  className?: string;
};

const tile =
  "flex min-w-0 items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.035] p-3.5";

/** « En bref » : la série en cours et l'énergie du jour. */
export function DayTiles({ streak, energy, className }: DayTilesProps) {
  const t = useTranslations("Today.tiles");
  const tCheckIn = useTranslations("Today.checkIn");

  return (
    <section
      aria-label={t("label")}
      className={cn("grid grid-cols-2 gap-3", className)}
    >
      <div className={tile}>
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

      {energy !== null ? (
        <div className={tile}>
          <Zap aria-hidden="true" className="size-7 shrink-0 text-silver" />
          <div className="flex min-w-0 flex-col">
            <span className="font-mono text-xl font-bold">
              {tCheckIn("score", { score: energy })}
            </span>
            <span className="text-xs text-muted-foreground">
              {t("energyLabel")}
            </span>
          </div>
        </div>
      ) : (
        <a
          href="#check-in"
          className={cn(
            tile,
            "transition-colors outline-none hover:border-primary/40 focus-visible:ring-3 focus-visible:ring-ring/50",
          )}
        >
          <Zap aria-hidden="true" className="size-7 shrink-0 text-primary" />
          <div className="flex min-w-0 flex-col">
            <span className="font-mono text-xl font-bold">{t("checkIn")}</span>
            <span className="text-xs text-muted-foreground">
              {t("checkInLabel")}
            </span>
          </div>
        </a>
      )}
    </section>
  );
}
