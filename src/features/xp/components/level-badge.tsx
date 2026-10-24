import { useTranslations } from "next-intl";
import { Avatar } from "@/components/avatar";
import { ProgressRing } from "@/components/progress-ring";
import { Link } from "@/i18n/navigation";
import type { LevelProgress } from "../rules";

type LevelBadgeProps = {
  level: LevelProgress;
  /** XP totale. */
  xp: number;
  /** Nom (pour l'initiale) et photo affichés dans l'anneau. */
  name: string;
  avatarUrl: string | null;
};

/** Niveau et XP, avec l'anneau d'avancement autour de la photo : mène au profil. */
export function LevelBadge({ level, xp, name, avatarUrl }: LevelBadgeProps) {
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
