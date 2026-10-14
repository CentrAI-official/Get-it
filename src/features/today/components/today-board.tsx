"use client";

import {
  useMemo,
  useOptimistic,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { PILLARS, type Pillar } from "@/config/pillars";
import { setHabitDayAction } from "@/features/habits/actions";
import { computeStreaks } from "@/features/habits/streak";
import { deleteTaskAction, setTaskDoneAction } from "@/features/tasks/actions";
import { LevelBadge } from "@/features/xp/components/level-badge";
import { LevelUpBanner } from "@/features/xp/components/level-up-banner";
import { levelFromXp } from "@/features/xp/rules";
import type { HabitSummary } from "@/server/habits/service";
import type { DayTask } from "@/server/tasks/service";
import { summarizeDay } from "../day-plan";
import { DayTiles } from "./day-tiles";
import { QuestList, type Quest, type TaskQuest } from "./quest-list";
import { SystemOrbit } from "./system-orbit";

type TodayBoardProps = {
  /** Aujourd'hui, dans le fuseau de l'utilisateur. */
  today: string;
  /** Habitudes prévues aujourd'hui. */
  habits: HabitSummary[];
  /** Tâches dues aujourd'hui et tâches en retard. */
  tasks: DayTask[];
  scores: Record<Pillar, number | null>;
  /** Meilleure série des habitudes qui ne sont pas prévues aujourd'hui. */
  otherStreak: number;
  hasHabits: boolean;
  /** XP totale enregistrée, et XP de chaque quête (« habit:<id> » → XP). */
  xp: { total: number; quests: Record<string, number> };
  /** Initiale de l'utilisateur, dans l'anneau de niveau. */
  initial: string;
  /** Salutation, rendue par le serveur. */
  greeting: ReactNode;
  /** Carte du check-in, rendue par le serveur. */
  checkIn: ReactNode;
};

const NO_KEYS: ReadonlySet<string> = new Set();

/** Ordre d'affichage des quêtes : par pilier, les tâches sans objectif à la fin. */
const pillarRank = (pillar: Pillar | null) =>
  pillar === null ? PILLARS.length : PILLARS.indexOf(pillar);

/**
 * La page Aujourd'hui interactive. Un seul état optimiste pour les habitudes
 * et les tâches : un clic met à jour la case, l'orbite, le %, la série et l'XP d'un coup.
 */
export function TodayBoard({
  today,
  habits,
  tasks,
  scores,
  otherStreak,
  hasHabits,
  xp,
  initial,
  greeting,
  checkIn,
}: TodayBoardProps) {
  const [filter, setFilter] = useState<Pillar | null>(null);
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
        xp: xp.quests[key] ?? 0,
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
          xp: xp.quests[key] ?? 0,
          late: task.dueDate !== null && task.dueDate < today,
          dueDate: task.dueDate,
          goalTitle: task.goal?.title ?? null,
        };
      }),
  ].sort((a, b) => pillarRank(a.pillar) - pillarRank(b.pillar));

  const summary = summarizeDay(quests);
  const shown = filter
    ? quests.filter((quest) => quest.pillar === filter)
    : quests;
  const streak = Math.max(
    otherStreak,
    ...quests.map((quest) => (quest.kind === "habit" ? quest.streak : 0)),
  );
  // XP affichée : l'enregistrée, plus ou moins les coches en cours
  const xpNow = quests.reduce(
    (sum, quest) =>
      sum + (Number(quest.done) - Number(saved[quest.key] ?? false)) * quest.xp,
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

  return (
    <div className="flex flex-col gap-5 lg:gap-6">
      <div className="flex items-start justify-between gap-4">
        {greeting}
        <LevelBadge level={level} xp={xpNow} initial={initial} />
      </div>
      <LevelUpBanner
        level={level.level > celebrated ? level.level : null}
        onClose={() => setCelebrated(level.level)}
      />
      <div className="grid gap-5 lg:grid-cols-[5fr_6fr] lg:grid-rows-[auto_auto_1fr] lg:gap-6">
        <SystemOrbit
          className="lg:col-start-1 lg:row-start-1"
          scores={scores}
          day={summary.day}
          pillars={summary.pillars}
          filter={filter}
          onFilterChange={setFilter}
        />
        <DayTiles
          className="lg:col-start-1 lg:row-start-2"
          streak={streak}
          level={level}
        />
        <QuestList
          className="lg:col-start-2 lg:row-span-3 lg:row-start-1"
          quests={shown}
          filter={filter}
          today={today}
          pending={pending}
          allDone={
            summary.day.total > 0 && summary.day.done === summary.day.total
          }
          hasHabits={hasHabits}
          onToggle={toggle}
          onDelete={remove}
          onClearFilter={() => setFilter(null)}
        />
        <div className="lg:col-start-1 lg:row-start-3 lg:self-start">
          {checkIn}
        </div>
      </div>
    </div>
  );
}
