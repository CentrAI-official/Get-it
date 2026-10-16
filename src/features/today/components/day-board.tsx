"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  DialogClose,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { PILLARS, type Pillar } from "@/config/pillars";
import {
  setGoalStatusAction,
  setMilestoneDoneAction,
} from "@/features/goals/actions";
import { setHabitDayAction } from "@/features/habits/actions";
import { computeStreaks } from "@/features/habits/streak";
import { deleteTaskAction, setTaskDoneAction } from "@/features/tasks/actions";
import { LevelBadge } from "@/features/xp/components/level-badge";
import { LevelUpBanner } from "@/features/xp/components/level-up-banner";
import { levelFromXp } from "@/features/xp/rules";
import { Link } from "@/i18n/navigation";
import type { DayPlan } from "@/server/day/service";
import type { DayGoal } from "@/server/goals/service";
import { ratio, summarizeDay } from "../day-plan";
import { DayGoals } from "./day-goals";
import { QuestList, type Quest, type TaskQuest } from "./quest-list";

type DayBoardProps = {
  plan: DayPlan;
  /** « JEU · 08 OCT », dans le fuseau de l'utilisateur. */
  stamp: string;
  /** « Bonsoir, Max. » */
  greeting: string;
  /** Initiale de l'utilisateur, dans l'anneau de niveau. */
  initial: string;
};

const NO_KEYS: ReadonlySet<string> = new Set();

/** Ordre d'affichage des quêtes : par pilier, les tâches sans objectif à la fin. */
const pillarRank = (pillar: Pillar | null) =>
  pillar === null ? PILLARS.length : PILLARS.indexOf(pillar);

/**
 * Le contenu de « Ma journée ». Un seul état optimiste pour les habitudes, les
 * tâches, les jalons et les objectifs : un clic met à jour la case, l'avancement
 * du jour et l'XP d'un coup.
 */
export function DayBoard({ plan, stamp, greeting, initial }: DayBoardProps) {
  const t = useTranslations("Today.panel");
  const format = useFormatter();
  const { today, habits, tasks, goals, xp } = plan;
  // Dernier niveau fêté : une coche qui le dépasse affiche la bannière
  const [celebrated, setCelebrated] = useState(
    () => levelFromXp(xp.total).level,
  );
  const [pending, startTransition] = useTransition();

  const saved = useMemo(() => {
    const done: Record<string, boolean> = {};
    for (const habit of habits) {
      done[`habit:${habit.id}`] = habit.completions.includes(today);
    }
    for (const task of tasks) done[`task:${task.id}`] = task.done;
    return done;
  }, [habits, tasks, today]);
  const [done, setDone] = useOptimistic(
    saved,
    (current, change: { key: string; done: boolean }) => ({
      ...current,
      [change.key]: change.done,
    }),
  );
  const [removed, setRemoved] = useOptimistic(
    NO_KEYS,
    (current, key: string) => new Set([...current, key]),
  );

  const quests: Quest[] = [
    ...habits.map((habit): Quest => {
      const key = `habit:${habit.id}`;
      const isDone = done[key] ?? false;
      const completions = new Set(habit.completions);
      if (isDone) completions.add(today);
      else completions.delete(today);
      const { current } = computeStreaks({
        weekdays: habit.weekdays,
        completions,
        startDay: habit.startDay,
        today,
      });
      return {
        kind: "habit",
        key,
        id: habit.id,
        title: habit.title,
        pillar: habit.pillar,
        done: isDone,
        xp: xp.items[key] ?? 0,
        late: false,
        streak: current,
      };
    }),
    ...tasks
      .filter((task) => !removed.has(`task:${task.id}`))
      .map((task): Quest => {
        const key = `task:${task.id}`;
        return {
          kind: "task",
          key,
          id: task.id,
          title: task.title,
          pillar: task.goal?.pillar ?? null,
          done: done[key] ?? false,
          xp: xp.items[key] ?? 0,
          late: task.dueDate !== null && task.dueDate < today,
          dueDate: task.dueDate,
          goalTitle: task.goal?.title ?? null,
        };
      }),
  ].sort((a, b) => pillarRank(a.pillar) - pillarRank(b.pillar));

  const { day } = summarizeDay(quests);
  // XP affichée : l'enregistrée, plus ou moins les coches en cours
  const xpNow = Object.entries(xp.items).reduce(
    (sum, [key, amount]) =>
      sum + (Number(done[key] ?? false) - Number(saved[key] ?? false)) * amount,
    xp.total,
  );
  const level = levelFromXp(xpNow);

  function toggle(quest: Quest) {
    const next = !quest.done;
    startTransition(async () => {
      setDone({ key: quest.key, done: next });
      if (quest.kind === "habit") {
        await setHabitDayAction(quest.id, today, next);
      } else {
        await setTaskDoneAction(quest.id, next);
      }
    });
  }

  function remove(quest: TaskQuest) {
    // Le bouton disparaît : le focus revient au titre de la liste
    document.getElementById("quests-title")?.focus();
    startTransition(async () => {
      setRemoved(quest.key);
      await deleteTaskAction(quest.id);
    });
  }

  function toggleMilestone(goal: DayGoal, next: boolean) {
    const milestone = goal.nextMilestone;
    if (!milestone) return;
    startTransition(async () => {
      setDone({ key: `milestone:${milestone.id}`, done: next });
      await setMilestoneDoneAction(milestone.id, next);
    });
  }

  function completeGoal(goal: DayGoal) {
    startTransition(async () => {
      setDone({ key: `goal:${goal.id}`, done: true });
      await setGoalStatusAction(goal.id, "completed");
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-4 pr-10">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="font-mono text-xs tracking-[0.16em] text-muted-foreground">
            {stamp}
          </p>
          <DialogTitle className="text-2xl leading-tight tracking-tight text-balance sm:text-3xl">
            {greeting}
          </DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </div>
        <LevelBadge level={level} xp={xpNow} initial={initial} />
      </div>

      {day.total > 0 ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="text-muted-foreground">
              {t("progress", { done: day.done, total: day.total })}
            </span>
            <span className="font-mono font-bold text-primary">
              {format.number(ratio(day), { style: "percent" })}
            </span>
          </div>
          <Progress
            value={Math.round(ratio(day) * 100)}
            aria-label={t("progress", { done: day.done, total: day.total })}
          />
        </div>
      ) : null}

      <LevelUpBanner
        level={level.level > celebrated ? level.level : null}
        onClose={() => setCelebrated(level.level)}
      />

      <QuestList
        quests={quests}
        filter={null}
        today={today}
        pending={pending}
        allDone={day.total > 0 && day.done === day.total}
        hasHabits={plan.hasHabits}
        onToggle={toggle}
        onDelete={remove}
        onClearFilter={() => undefined}
      />

      <DayGoals
        goals={goals}
        done={done}
        xp={xp.items}
        onToggleMilestone={toggleMilestone}
        onCompleteGoal={completeGoal}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/5 pt-4">
        <Link
          href="/profile"
          className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {t("profileLink")}
        </Link>
        <DialogClose asChild>
          <Button>{t("start")}</Button>
        </DialogClose>
      </div>
    </div>
  );
}
