"use client";

import { Flame, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

type StreakBannerProps = {
  /** Palier atteint (7, 30, 100, 365 jours), ou null quand il n'y a rien à fêter. */
  milestone: number | null;
  onClose: () => void;
};

/** « Série de 7 jours! » : apparaît quand une coche fait franchir un palier. */
export function StreakBanner({ milestone, onClose }: StreakBannerProps) {
  const t = useTranslations("Streaks.milestone");

  return (
    // Région toujours présente : le message est annoncé dès qu'il apparaît
    <div role="status" aria-live="polite">
      {milestone !== null ? (
        <div className="flex items-center gap-3 rounded-3xl border border-primary/40 bg-primary/12 p-4 glow-primary motion-safe:animate-level-up">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Flame aria-hidden="true" className="size-5" />
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <p className="font-heading text-lg font-bold">
              {t("title", { count: milestone })}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("body", { count: milestone })}
            </p>
            <Link
              href="/community?partager=dayStreak"
              className="mt-1 w-fit text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              {t("share")}
            </Link>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("close")}
            onClick={onClose}
          >
            <X aria-hidden="true" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
