import "server-only";
import type { GoalRef } from "@/features/coach/coach-tools";
import { formatCoachContext } from "@/features/coach/context";
import { computeStreaks } from "@/features/habits/streak";
import { selectHabitsToday } from "@/features/today/day-plan";
import {
  computePillarScores,
  scoreWindow,
} from "@/features/today/pillar-scores";
import { dayStreak } from "@/features/streaks/rules";
import { PILLARS, type Pillar } from "@/config/pillars";
import { addDays, toCalendarDay } from "@/lib/dates";
import { listCheckIns } from "@/server/check-ins/service";
import { listActiveGoalPlans } from "@/server/goals/service";
import { listHabits } from "@/server/habits/service";
import { getLatestAssessments } from "@/server/profile/service";
import { getMyLevels } from "@/server/levels/service";
import { getActivity } from "@/server/streaks/service";
import { listDayTasks, listGoalTasksDueBetween } from "@/server/tasks/service";

type ContextProfile = {
  displayName: string | null;
  occupation: string | null;
  focusPillars: Pillar[];
  dailyMinutes: number | null;
  timeZone: string;
};

/**
 * Contexte de l'utilisateur pour Get iT AI (§15-16) : objectifs, quêtes du jour,
 * habitudes, scores, séries, niveaux mesurés et check-ins récents, résumés et
 * bornés. Renvoie
 * aussi les objectifs avec leur référence courte (G1…), pour relier les
 * propositions du coach au bon objectif.
 */
export async function buildCoachContext(
  userId: string,
  profile: ContextProfile,
): Promise<{ text: string; today: string; goals: GoalRef[] }> {
  const today = toCalendarDay(new Date(), profile.timeZone);
  const scoreDays = scoreWindow(today);
  const [
    habits,
    tasks,
    recentTasks,
    assessments,
    activity,
    ranked,
    checkIns,
    goals,
  ] = await Promise.all([
    listHabits(userId, profile.timeZone),
    listDayTasks(userId, today, profile.timeZone),
    listGoalTasksDueBetween(userId, scoreDays.from, scoreDays.to),
    getLatestAssessments(userId),
    getActivity(userId, profile.timeZone),
    getMyLevels(userId),
    listCheckIns(userId, addDays(today, -6), today),
    listActiveGoalPlans(userId),
  ]);
  const dayStreakCount = dayStreak(activity.days, today);

  const active = habits.filter((habit) => !habit.archived);
  const streaks = new Map(
    active.map((habit) => [
      habit.id,
      computeStreaks({
        weekdays: habit.weekdays,
        completions: new Set(habit.completions),
        startDay: habit.startDay,
        today,
      }),
    ]),
  );

  const refs = goals.map((goal, index) => ({ ...goal, ref: `G${index + 1}` }));
  const text = formatCoachContext({
    today,
    name: profile.displayName,
    occupation: profile.occupation,
    focusPillars: profile.focusPillars,
    dailyMinutes: profile.dailyMinutes,
    streaks: {
      current: dayStreakCount.current,
      best: dayStreakCount.best,
      pillars: Object.fromEntries(
        PILLARS.map((pillar) => [
          pillar,
          dayStreak(activity.pillars[pillar], today).current,
        ]),
      ) as Record<Pillar, number>,
    },
    levels: {
      total: ranked.total,
      physical: ranked.physical,
      financial: ranked.financial,
    },
    scores: computePillarScores({
      habits,
      tasks: recentTasks,
      assessments,
      today,
    }),
    quests: [
      ...selectHabitsToday(active, today).map((habit) => ({
        title: habit.title,
        kind: "habit" as const,
        pillar: habit.pillar,
        done: habit.completions.includes(today),
        overdueSince: null,
        goal: habit.goal?.title ?? null,
        streak: streaks.get(habit.id)?.current ?? null,
      })),
      ...tasks.map((task) => ({
        title: task.title,
        kind: "task" as const,
        pillar: task.goal?.pillar ?? null,
        done: task.done,
        overdueSince:
          !task.done && task.dueDate && task.dueDate < today
            ? task.dueDate
            : null,
        goal: task.goal?.title ?? null,
        streak: null,
      })),
    ],
    goals: refs,
    habits: active.map((habit) => ({
      title: habit.title,
      pillar: habit.pillar,
      weekdays: habit.weekdays,
      currentStreak: streaks.get(habit.id)?.current ?? 0,
      bestStreak: streaks.get(habit.id)?.best ?? 0,
      doneToday: habit.completions.includes(today),
    })),
    checkIns,
  });
  return {
    text,
    today,
    goals: refs.map(({ ref, id, title, pillar }) => ({
      ref,
      id,
      title,
      pillar,
    })),
  };
}
