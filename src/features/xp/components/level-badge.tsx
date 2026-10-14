import { useTranslations } from "next-intl";
import { ProgressRing } from "@/components/progress-ring";
import { Link } from "@/i18n/navigation";
import type { LevelProgress } from "../rules";

type LevelBadgeProps = {
  level: LevelProgress;
  /** XP totale. */
  xp: number;
  /** Initiale affichée dans l'anneau. */
  initial: string;
};

/** Niveau et XP, avec l'anneau d'avancement autour de l'initiale : mène au profil. */
export function LevelBadge({ level, xp, initial }: LevelBadgeProps) {
  const t = useTranslations("Xp");

  return (
    <Link
      href="/profile"
      aria-label={t("badgeLabel", { level: level.level, xp })}
      className="flex shrink-0 items-center gap-2.5 rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span aria-hidden="true" className="flex flex-col items-end gap-0.5">
        <span className="text-xs text-muted-foreground">
          {t("level", { level: level.level })}
        </span>
        <span className="font-mono text-xs font-bold text-primary">
          {t("xp", { xp })}
        </span>
      </span>
      <ProgressRing value={level.progress} className="size-12 p-[2.5px]">
        <span className="font-heading text-lg font-bold uppercase">
          {initial}
        </span>
      </ProgressRing>
    </Link>
  );
}
