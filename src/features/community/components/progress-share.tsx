import { Flag, Flame, Target, Trophy } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { ProgressData } from "../rules";

const ICONS = {
  goal: Trophy,
  milestone: Flag,
  streak: Flame,
  level: Target,
} as const;

/** Phrase d'un progrès (« Objectif atteint : … »), figée au moment du partage. */
export function ProgressSentence({ progress }: { progress: ProgressData }) {
  const t = useTranslations("Community.progress");
  switch (progress.type) {
    case "goal":
      return t("goal", { title: progress.title });
    case "milestone":
      return t("milestone", {
        title: progress.title,
        goal: progress.goalTitle,
      });
    case "streak":
      return t("streak", { title: progress.title, days: progress.days });
    case "level":
      return t("level", { level: progress.level });
  }
}

/** Carte d'un progrès partagé, dans le fil ou au moment de choisir quoi partager. */
export function ProgressShare({
  progress,
  className,
}: {
  progress: ProgressData;
  className?: string;
}) {
  const Icon = ICONS[progress.type];
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl border border-primary/25 bg-primary/[0.07] p-3",
        className,
      )}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground glow-primary">
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <p className="min-w-0 font-semibold break-words">
        <ProgressSentence progress={progress} />
      </p>
    </div>
  );
}
