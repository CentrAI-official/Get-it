"use client";

import { Check, ListChecks, SquareCheckBig } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { pillarIcons } from "@/config/pillars";
import { cn } from "@/lib/utils";
import { FOCUS_DAYS, type SegmentState } from "../focus";
import { QuestPact, useQuestMeta, type Quest } from "./quest-list";

export type FocusSegment = { key: string; title: string; state: SegmentState };

const SEGMENT_COLORS: Record<SegmentState, string> = {
  done: "bg-primary",
  current: "bg-foreground",
  later: "bg-white/30",
  todo: "bg-white/12",
};

type FocusQuestProps = {
  quest: Quest;
  /** Barre du haut : une case par quête, dans l'ordre de passage. */
  segments: FocusSegment[];
  /** Titre du popup (salutation), au-dessus du compteur. */
  heading: ReactNode;
  /** Bannière « Niveau atteint », sous l'en-tête. */
  banner?: ReactNode;
  /** Il reste une autre quête à faire après celle-ci. */
  hasNext: boolean;
  onDone: () => void;
  onLater: () => void;
  onNext: () => void;
  onUndo: () => void;
  onJump: (key: string) => void;
  onShowList: () => void;
};

/**
 * Mode Focus de « Ma journée » : une seule quête à l'écran, en grand, avec un
 * seul geste principal (« C'est fait »).
 */
export function FocusQuest({
  quest,
  segments,
  heading,
  banner,
  hasNext,
  onDone,
  onLater,
  onNext,
  onUndo,
  onJump,
  onShowList,
}: FocusQuestProps) {
  const t = useTranslations("Today.focus");
  const tQuests = useTranslations("Today.quests");
  const tPillars = useTranslations("Pillars");
  const questMeta = useQuestMeta();
  // « +10 XP » qui s'envole au-dessus du bouton ; survit au changement de carte
  const [burst, setBurst] = useState<{ id: number; xp: number } | null>(null);

  const index = segments.findIndex((segment) => segment.key === quest.key);
  const Icon = quest.pillar ? pillarIcons[quest.pillar] : SquareCheckBig;
  const pact = quest.kind === "habit" ? quest.pact : undefined;
  const days = quest.kind === "habit" ? quest.days : undefined;

  function done() {
    if (quest.xp > 0) {
      setBurst((current) => ({ id: (current?.id ?? 0) + 1, xp: quest.xp }));
    }
    onDone();
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <ol
        aria-label={t("segments")}
        className="mr-10 grid gap-1"
        style={{
          gridTemplateColumns: `repeat(${segments.length}, minmax(0, 1fr))`,
        }}
      >
        {segments.map((segment, position) => {
          const label = {
            n: position + 1,
            title: segment.title,
          };
          return (
            <li key={segment.key}>
              <button
                type="button"
                onClick={() => onJump(segment.key)}
                aria-current={segment.state === "current" ? "step" : undefined}
                aria-label={
                  segment.state === "done"
                    ? t("segmentDone", label)
                    : segment.state === "later"
                      ? t("segmentLater", label)
                      : t("segment", label)
                }
                className="flex h-6 w-full items-center rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span
                  className={cn(
                    "h-1 w-full rounded-full transition-colors duration-300",
                    SEGMENT_COLORS[segment.state],
                  )}
                />
              </button>
            </li>
          );
        })}
      </ol>

      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          {heading}
          <p className="text-sm text-muted-foreground">
            {t("counter", { n: index + 1, total: segments.length })}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onShowList}
          aria-label={t("listLabel")}
          className="shrink-0 text-muted-foreground"
        >
          <ListChecks aria-hidden="true" />
          {t("list")}
        </Button>
      </div>

      {banner}

      {/* Nouvelle carte à chaque quête : elle glisse depuis la droite */}
      <div
        key={quest.key}
        className="flex flex-1 flex-col justify-center gap-5 py-4 motion-safe:animate-in motion-safe:duration-300 motion-safe:fade-in-0 motion-safe:slide-in-from-right-8"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-sm font-semibold text-silver">
            <Icon aria-hidden="true" className="size-4" />
            {quest.pillar ? tPillars(`${quest.pillar}.name`) : t("task")}
          </span>
          {quest.done ? (
            <span className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground">
              <Check aria-hidden="true" className="size-4" strokeWidth={3} />
              {t("doneBadge")}
            </span>
          ) : null}
        </div>
        <h3
          className={cn(
            "font-heading text-4xl leading-[1.05] font-bold tracking-tight break-words sm:text-5xl",
            quest.done && "text-muted-foreground",
          )}
        >
          {quest.title}
        </h3>
        <p
          className={cn(
            "text-base break-words",
            quest.late && !quest.done
              ? "text-destructive"
              : "text-muted-foreground",
          )}
        >
          {questMeta(quest)}
        </p>
        {pact ? <QuestPact pact={pact} /> : null}

        <div className="flex flex-col gap-2 pt-2">
          {days ? (
            <ol
              aria-hidden="true"
              className="grid items-center gap-1.5"
              style={{
                gridTemplateColumns: `repeat(${FOCUS_DAYS}, minmax(0, 1fr))`,
              }}
            >
              {days.map((day) => (
                <li
                  key={day.day}
                  className={cn(
                    "aspect-square rounded-full",
                    day.done
                      ? "bg-primary"
                      : day.planned
                        ? "bg-white/15"
                        : "mx-auto size-1.5 bg-white/10",
                  )}
                />
              ))}
            </ol>
          ) : null}
          <p className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>{days ? t("days", { count: FOCUS_DAYS }) : null}</span>
            {quest.xp > 0 ? (
              <span className="font-mono font-bold text-primary">
                {tQuests("xpReward", { xp: quest.xp })}
              </span>
            ) : null}
          </p>
        </div>
      </div>

      <div className="relative flex flex-col gap-2">
        {burst ? (
          // Retiré à la fin de l'animation ; jamais affiché si les animations sont réduites
          <span
            key={burst.id}
            aria-hidden="true"
            onAnimationEnd={() => setBurst(null)}
            className="pointer-events-none absolute -top-9 left-1/2 hidden -translate-x-1/2 font-mono text-lg font-bold text-primary opacity-0 motion-safe:block motion-safe:animate-xp-float"
          >
            {tQuests("xpReward", { xp: burst.xp })}
          </span>
        ) : null}
        {quest.done ? (
          <>
            <Button
              type="button"
              size="lg"
              onClick={onNext}
              className="h-16 rounded-full text-lg font-bold"
            >
              {hasNext ? t("next") : t("recap")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={onUndo}
              className="h-12 rounded-full text-base"
            >
              {t("undo")}
            </Button>
          </>
        ) : (
          <>
            <Button
              type="button"
              size="lg"
              onClick={done}
              className="h-16 rounded-full text-lg font-bold glow-primary"
            >
              <Check aria-hidden="true" className="size-6" strokeWidth={3} />
              {t("done")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={onLater}
              className="h-12 rounded-full text-base"
            >
              {t("later")}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
