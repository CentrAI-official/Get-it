"use client";

import { Flame } from "lucide-react";
import { useTranslations } from "next-intl";
import { Avatar } from "@/components/avatar";
import { ProgressRing } from "@/components/progress-ring";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

type StreakBadgeProps = {
  /** Série du jour affichée (aujourd'hui compris s'il compte déjà). */
  days: number;
  /** Aujourd'hui compte déjà : la flamme et l'anneau s'allument. */
  lit: boolean;
  /** Nom (pour l'initiale) et photo affichés dans l'anneau. */
  name: string;
  avatarUrl: string | null;
};

/** Série du jour, avec l'anneau qui s'allume autour de la photo : mène au profil. */
export function StreakBadge({ days, lit, name, avatarUrl }: StreakBadgeProps) {
  const t = useTranslations("Streaks");

  return (
    <Link
      href="/profile"
      aria-label={t(lit ? "badgeLabelLit" : "badgeLabel", { count: days })}
      className="flex shrink-0 items-center gap-2.5 rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span aria-hidden="true" className="flex flex-col items-end gap-0.5">
        <span className="text-xs text-muted-foreground">{t("caption")}</span>
        <span
          className={cn(
            "flex items-center gap-1 text-xs font-bold tabular-nums transition-colors",
            lit ? "text-primary" : "text-muted-foreground",
          )}
        >
          <Flame
            className={cn("size-3.5", lit && "motion-safe:animate-level-up")}
          />
          {t("days", { count: days })}
        </span>
      </span>
      <ProgressRing value={lit ? 1 : 0} className="size-12 p-[2.5px]">
        {avatarUrl ? (
          <Avatar name={name} url={avatarUrl} className="size-full" />
        ) : (
          <span className="font-heading text-lg font-bold uppercase">
            {name.charAt(0)}
          </span>
        )}
      </ProgressRing>
    </Link>
  );
}
