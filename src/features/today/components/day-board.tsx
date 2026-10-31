"use client";

import { Check } from "lucide-react";
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
import { setHabitDayAction } from "@/features/habits/actions";
import { computeStreaks } from "@/features/habits/streak";
import { deleteTaskAction, setTaskDoneAction } from "@/features/tasks/actions";
import { LevelBadge } from "@/features/xp/components/level-badge";
import { LevelUpBanner } from "@/features/xp/components/level-up-banner";
import { levelFromXp } from "@/features/xp/rules";
import { Link } from "@/i18n/navigation";
import type { DayPlan } from "@/server/day/service";
import { ratio, summarizeDay } from "../day-plan";
import {
  focusOrder,
  habitDays,
  mergeOrder,
  nextFocus,
  segmentState,
} from "../focus";
import { FocusQuest } from "./focus-quest";
import { QuestList, type Quest, type TaskQuest } from "./quest-list";

type DayBoardProps = {
  plan: DayPlan;
  /** « JEU · 08 OCT », dans le fuseau de l'utilisateur. */
  stamp: string;
  /** « Bonsoir, Max. » */
  greeting: string;
  /** Initiale de l'utilisateur, dans l'anneau de niveau. */
  name: string;
  avatarUrl: string | null;
  /** Niveau Ranked : affiché à la place de celui de l'XP, sans bannière de montée. */
  rankedLevel: number | null;
};

const NO_KEYS: ReadonlySet<string> = new Set();

/** Ordre d'affichage des quêtes : par pilier, les tâches sans objectif à la fin. */
const pillarRank = (pillar: Pillar | null) =>
  pillar === null ? PILLARS.length : PILLARS.indexOf(pillar);

/**
 * Le contenu de « Ma journée ». Un seul état optimiste pour les habitudes et
 * les tâches : un clic met à jour la case, l'avancement du jour et l'XP d'un coup.
 *
 * Mode Focus d'abord : une quête à la fois, puis le récap (liste complète,
 * nouvelle tâche) quand il ne reste rien à montrer.
 */
export function DayBoard({
  plan,
  stamp,
  greeting,
  name,
  avatarUrl,
  rankedLevel,
}: DayBoardProps) {
  const t = useTranslations("Today.panel");
  const tFocus = useTranslations("Today.focus");
  const format = useFormatter();
  const { today, habits, tasks, xp } = plan;
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
        time: habit.time,
        late: false,
        streak: current,
        days: habitDays(completions, habit.weekdays, today),
        pact: plan.pacts[habit.id],
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
          time: task.time,
          late: task.dueDate !== null && task.dueDate < today,
          dueDate: task.dueDate,
          goalTitle: task.goal?.title ?? null,
        };
      }),
  ].sort(
    (a, b) =>
      // Ce qui a une heure d’abord, dans l’ordre des heures ; puis par pilier
      (a.time ?? Infinity) - (b.time ?? Infinity) ||
      pillarRank(a.pillar) - pillarRank(b.pillar),
  );

  // Mode Focus : ordre de passage figé à l'ouverture, « Plus tard » le temps
  // de l'ouverture seulement
  const [snapshot] = useState(() => focusOrder(quests));
  const order = mergeOrder(
    snapshot,
    quests.map((quest) => quest.key),
  );
  const [later, setLater] = useState<ReadonlySet<string>>(NO_KEYS);
  const [current, setCurrent] = useState(() =>
    nextFocus(snapshot, done, NO_KEYS, null),
  );
  const [showList, setShowList] = useState(false);
  const focused = showList
    ? undefined
    : quests.find((quest) => quest.key === current);

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

  function completeFocused(quest: Quest) {
    setCurrent(
      nextFocus(order, { ...done, [quest.key]: true }, later, quest.key),
    );
    toggle(quest);
  }

  function keepForLater(quest: Quest) {
    const next = new Set(later).add(quest.key);
    setLater(next);
    setCurrent(nextFocus(order, done, next, quest.key));
  }

  function jumpTo(key: string) {
    setLater((current) => {
      const next = new Set(current);
      next.delete(key);
      return next;
    });
    setCurrent(key);
  }

  function resume() {
    setShowList(false);
    setLater(NO_KEYS);
    setCurrent((key) =>
      key !== null && done[key] === false
        ? key
        : nextFocus(order, done, NO_KEYS, null),
    );
  }

  const levelUp = (
    <LevelUpBanner
      level={
        rankedLevel === null && level.level > celebrated ? level.level : null
      }
      onClose={() => setCelebrated(level.level)}
    />
  );

  if (focused) {
    return (
      <div className="flex flex-1 flex-col">
        <FocusQuest
          quest={focused}
          segments={order.map((key) => ({
            key,
            title: quests.find((quest) => quest.key === key)?.title ?? "",
            state: segmentState(key, focused.key, done, later),
          }))}
          heading={
            <>
              <DialogTitle className="text-base leading-tight font-semibold">
                {greeting}
              </DialogTitle>
              <DialogDescription className="sr-only">
                {tFocus("description")}
              </DialogDescription>
            </>
          }
          banner={levelUp}
          hasNext={nextFocus(order, done, later, focused.key) !== null}
          onDone={() => completeFocused(focused)}
          onLater={() => keepForLater(focused)}
          onNext={() => setCurrent(nextFocus(order, done, later, focused.key))}
          onUndo={() => toggle(focused)}
          onJump={jumpTo}
          onShowList={() => setShowList(true)}
        />
      </div>
    );
  }

  const left = quests.filter((quest) => !quest.done).length;
  const xpToday = quests.reduce(
    (sum, quest) => sum + (quest.done ? quest.xp : 0),
    0,
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-4 pr-10">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground">
            {stamp}
          </p>
          <DialogTitle className="font-display text-4xl leading-[0.95] text-balance uppercase sm:text-5xl">
            {greeting}
          </DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </div>
        <LevelBadge
          level={
            rankedLevel === null
              ? level
              : {
                  level: rankedLevel,
                  current: rankedLevel,
                  needed: 100,
                  progress: rankedLevel / 100,
                }
          }
          xp={xpNow}
          name={name}
          avatarUrl={avatarUrl}
        />
      </div>

      {quests.length > 0 && left === 0 ? (
        <div className="flex items-center gap-4 border-b border-foreground/8 pb-5 motion-safe:animate-level-up">
          <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground glow-primary">
            <Check aria-hidden="true" className="size-8" strokeWidth={3} />
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <p className="font-heading text-2xl font-bold">
              {tFocus("allDoneTitle")}
            </p>
            <p className="text-sm text-muted-foreground">
              {tFocus("allDoneBody")}
            </p>
            {xpToday > 0 ? (
              <p className="text-sm font-bold text-primary tabular-nums">
                {tFocus("xpToday", { xp: xpToday })}
              </p>
            ) : null}
          </div>
        </div>
      ) : left > 0 ? (
        <div className="flex flex-col items-start gap-3 border-b border-foreground/8 pb-5">
          <p className="font-heading text-2xl font-bold">
            {tFocus("restTitle")}
          </p>
          <p className="text-sm text-muted-foreground">
            {tFocus("restBody", { left })}
          </p>
          <Button size="lg" className="rounded-full px-6" onClick={resume}>
            {tFocus("resume")}
          </Button>
        </div>
      ) : null}

      {day.total > 0 ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="text-muted-foreground">
              {t("progress", { done: day.done, total: day.total })}
            </span>
            <span className="font-bold text-primary tabular-nums">
              {format.number(ratio(day), { style: "percent" })}
            </span>
          </div>
          <Progress
            value={Math.round(ratio(day) * 100)}
            aria-label={t("progress", { done: day.done, total: day.total })}
          />
        </div>
      ) : null}

      {levelUp}

      <QuestList
        quests={quests}
        filter={null}
        today={today}
        pending={pending}
        allDone={false}
        onToggle={toggle}
        onDelete={remove}
        onClearFilter={() => undefined}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-foreground/5 pt-4">
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
