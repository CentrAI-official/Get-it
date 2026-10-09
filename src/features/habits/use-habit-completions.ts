"use client";

import { useMemo, useOptimistic, useTransition } from "react";
import { setHabitDayAction } from "./actions";
import { computeStreaks } from "./streak";

type TrackedHabit = {
  id: string;
  weekdays: readonly number[];
  startDay: string;
  completions: readonly string[];
};

/**
 * Jours faits d'une habitude, cochables tout de suite (mise à jour optimiste),
 * avec les séries recalculées à chaque clic.
 */
export function useHabitCompletions(habit: TrackedHabit, today: string) {
  const saved = useMemo(() => new Set(habit.completions), [habit.completions]);
  const [completions, setCompletion] = useOptimistic(
    saved,
    (current, change: { day: string; done: boolean }) => {
      const next = new Set(current);
      if (change.done) next.add(change.day);
      else next.delete(change.day);
      return next;
    },
  );
  const [, startTransition] = useTransition();

  function toggle(day: string) {
    const done = !completions.has(day);
    startTransition(async () => {
      setCompletion({ day, done });
      await setHabitDayAction(habit.id, day, done);
    });
  }

  const streaks = computeStreaks({
    weekdays: habit.weekdays,
    completions,
    startDay: habit.startDay,
    today,
  });

  return { completions, toggle, ...streaks };
}
