"use client";

import { Check, Trophy } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { ProgressRing } from "@/components/progress-ring";
import { Button } from "@/components/ui/button";
import { pillarIcons } from "@/config/pillars";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { DayGoal } from "@/server/goals/service";

type DayGoalsProps = {
  goals: DayGoal[];
  /** État coché (optimiste) de chaque élément : « milestone:<id> », « goal:<id> ». */
  done: Record<string, boolean>;
  /** XP de chaque élément, mêmes clés. */
  xp: Record<string, number>;
  onToggleMilestone: (goal: DayGoal, done: boolean) => void;
  onCompleteGoal: (goal: DayGoal) => void;
};

/** Objectifs en cours : cocher le prochain jalon, ou marquer l'objectif atteint. */
export function DayGoals({
  goals,
  done,
  xp,
  onToggleMilestone,
  onCompleteGoal,
}: DayGoalsProps) {
  const t = useTranslations("Today.panel.goals");
  const tQuests = useTranslations("Today.quests");
  const tPillars = useTranslations("Pillars");
  const [confirming, setConfirming] = useState<string | null>(null);
  // Objectifs atteints pendant cette ouverture : fêtés même après le rechargement
  const [achieved, setAchieved] = useState<{ goal: DayGoal; xp: number }[]>([]);
  const active = goals.filter(
    (goal) => !achieved.some((item) => item.goal.id === goal.id),
  );

  function complete(goal: DayGoal) {
    setConfirming(null);
    setAchieved((current) => [
      ...current,
      { goal, xp: xp[`goal:${goal.id}`] ?? 0 },
    ]);
    onCompleteGoal(goal);
  }

  return (
    <section aria-labelledby="day-goals-title" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="day-goals-title" className="font-heading text-lg font-bold">
          {t("title")}
        </h2>
        <Link
          href="/goals"
          className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {t("all")}
        </Link>
      </div>

      {achieved.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {achieved.map(({ goal, xp: earned }) => (
            <li
              key={goal.id}
              className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/[0.07] p-3"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground glow-primary">
                <Trophy aria-hidden="true" className="size-5" />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <p className="font-semibold break-words">
                  {t("achieved", { title: goal.title })}
                </p>
                <Link
                  href={`/community?partager=goal:${goal.id}`}
                  className="w-fit text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  {t("share")}
                </Link>
              </div>
              <span className="shrink-0 rounded-lg bg-primary px-2 py-1 font-mono text-xs font-bold text-primary-foreground">
                {tQuests("xpEarned", { xp: earned })}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {active.length === 0 && achieved.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-2xl glass p-4">
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
          <Button asChild variant="outline" size="sm">
            <Link href="/goals/new">{t("create")}</Link>
          </Button>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {active.map((goal) => {
            const Icon = pillarIcons[goal.pillar];
            const next = goal.nextMilestone;
            const milestoneKey = next ? `milestone:${next.id}` : null;
            const milestoneDone = milestoneKey
              ? (done[milestoneKey] ?? false)
              : false;
            const milestoneXp = milestoneKey ? (xp[milestoneKey] ?? 0) : 0;
            const doneCount = goal.milestonesDone + Number(milestoneDone);

            return (
              <li
                key={goal.id}
                className="flex flex-col gap-2 rounded-2xl border border-white/8 bg-white/[0.035] p-3"
              >
                <div className="flex items-start gap-3">
                  <ProgressRing
                    value={
                      goal.milestonesTotal > 0
                        ? doneCount / goal.milestonesTotal
                        : 0
                    }
                    className="size-10 p-[3px]"
                  >
                    <Icon className="size-4 text-silver" />
                  </ProgressRing>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <Link
                      href={`/goals/${goal.id}`}
                      className="font-medium break-words underline-offset-4 hover:underline"
                    >
                      {goal.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {t("meta", {
                        pillar: tPillars(`${goal.pillar}.name`),
                        done: doneCount,
                        total: goal.milestonesTotal,
                      })}
                    </p>
                  </div>
                </div>

                {next ? (
                  <button
                    type="button"
                    aria-pressed={milestoneDone}
                    onClick={() => onToggleMilestone(goal, !milestoneDone)}
                    className={cn(
                      "flex min-h-11 items-center gap-3 rounded-xl border px-2 py-1.5 text-left text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      milestoneDone
                        ? "border-primary/30 bg-primary/[0.07]"
                        : "border-white/8 hover:bg-white/[0.04]",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-full",
                        milestoneDone
                          ? "bg-primary text-primary-foreground"
                          : "border-2 border-white/20",
                      )}
                    >
                      {milestoneDone ? (
                        <Check className="size-3.5" strokeWidth={3} />
                      ) : null}
                    </span>
                    <span
                      className={cn(
                        "min-w-0 flex-1 break-words",
                        milestoneDone && "text-muted-foreground line-through",
                      )}
                    >
                      {t("nextMilestone", { title: next.title })}
                    </span>
                    {milestoneXp > 0 ? (
                      <span
                        className={cn(
                          "shrink-0 rounded-lg px-2 py-1 font-mono text-xs font-bold",
                          milestoneDone
                            ? "bg-primary text-primary-foreground"
                            : "bg-primary/12 text-primary",
                        )}
                      >
                        {milestoneDone
                          ? tQuests("xpEarned", { xp: milestoneXp })
                          : tQuests("xpReward", { xp: milestoneXp })}
                      </span>
                    ) : null}
                  </button>
                ) : null}

                {confirming === goal.id ? (
                  <div className="flex flex-col gap-2 rounded-xl border border-primary/30 bg-primary/[0.05] p-3">
                    <p className="text-sm">
                      {t("confirm", {
                        title: goal.title,
                        xp: xp[`goal:${goal.id}`] ?? 0,
                      })}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => complete(goal)}>
                        <Trophy aria-hidden="true" />
                        {t("confirmAction")}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setConfirming(null)}
                      >
                        {t("cancel")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirming(goal.id)}
                    className="w-fit text-muted-foreground"
                  >
                    <Trophy aria-hidden="true" />
                    {t("reached")}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
