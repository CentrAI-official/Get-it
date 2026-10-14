"use client";

import { Sparkles, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

type LevelUpBannerProps = {
  /** Niveau atteint, ou null quand il n'y a rien à fêter. */
  level: number | null;
  onClose: () => void;
};

/** « Niveau 8 atteint! » : apparaît quand une coche fait passer un niveau. */
export function LevelUpBanner({ level, onClose }: LevelUpBannerProps) {
  const t = useTranslations("Xp.levelUp");

  return (
    // Région toujours présente : le message est annoncé dès qu'il apparaît
    <div role="status" aria-live="polite">
      {level !== null ? (
        <div className="flex items-center gap-3 rounded-3xl border border-primary/40 bg-primary/12 p-4 glow-primary motion-safe:animate-level-up">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Sparkles aria-hidden="true" className="size-5" />
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <p className="font-heading text-lg font-bold">
              {t("title", { level })}
            </p>
            <p className="text-sm text-muted-foreground">{t("body")}</p>
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
