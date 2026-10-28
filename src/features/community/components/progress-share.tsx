import { Flag, Flame, Handshake, Target, Trophy } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { ProgressData } from "../rules";

const ICONS = {
  goal: Trophy,
  milestone: Flag,
  streak: Flame,
  level: Target,
  pact: Handshake,
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
    case "pact":
      return t("pact", {
        title: progress.title,
        together: progress.together,
        days: progress.days,
      });
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

/** Chiffre clé d'un progrès (jours de série, niveau, jours ensemble), s'il y en a un. */
function progressFigure(progress: ProgressData) {
  switch (progress.type) {
    case "streak":
      return progress.days;
    case "level":
      return progress.level;
    case "pact":
      return progress.together;
    default:
      return null;
  }
}

/** Progrès en grand (mode Focus du fil) : le chiffre clé, puis la phrase. Sans encadré. */
export function ProgressHero({
  progress,
  className,
}: {
  progress: ProgressData;
  className?: string;
}) {
  const format = useFormatter();
  const Icon = ICONS[progress.type];
  const figure = progressFigure(progress);
  return (
    <div className={cn("flex flex-col gap-3 py-1", className)}>
      <div className="flex items-center gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground glow-primary">
          <Icon aria-hidden="true" className="size-6" />
        </span>
        {figure !== null ? (
          <span
            aria-hidden="true"
            className="font-heading text-6xl leading-none font-bold tracking-tighter"
          >
            {format.number(figure)}
          </span>
        ) : null}
      </div>
      <p className="font-heading text-xl leading-snug font-bold break-words sm:text-2xl">
        <ProgressSentence progress={progress} />
      </p>
    </div>
  );
}

/** Pastille d'un progrès posée sur une photo. */
export function ProgressBadge({
  progress,
  className,
}: {
  progress: ProgressData;
  className?: string;
}) {
  const Icon = ICONS[progress.type];
  return (
    <p
      className={cn(
        "dark flex max-w-full items-center gap-2 rounded-full bg-black/80 py-2 pr-4 pl-2.5 text-sm font-semibold backdrop-blur-sm",
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-4 shrink-0 text-primary" />
      <span className="min-w-0 truncate">
        <ProgressSentence progress={progress} />
      </span>
    </p>
  );
}
