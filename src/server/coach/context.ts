import "server-only";
import type { GoalRef } from "@/features/coach/coach-tools";
import { formatCoachContext } from "@/features/coach/context";
import { computeStreaks } from "@/features/habits/streak";
import { selectHabitsToday } from "@/features/today/day-plan";
import {
  computePillarScores,
  scoreWindow,
} from "@/features/today/pillar-scores";
import { levelFromXp } from "@/features/xp/rules";
import { PILLARS, type Pillar } from "@/config/pillars";
import { addDays, toCalendarDay } from "@/lib/dates";
import { listCheckIns } from "@/server/check-ins/service";
import { listActiveGoalPlans } from "@/server/goals/service";
import { listHabits } from "@/server/habits/service";
import { getLatestAssessments } from "@/server/profile/service";
import { listDayTasks, listGoalTasksDueBetween } from "@/server/tasks/service";
import { getXpTotals } from "@/server/xp/service";

type ContextProfile = {
  displayName: string | null;
  occupation: string | null;
  focusPillars: Pillar[];
  dailyMinutes: number | null;
  timeZone: string;
};

/**
 * Contexte de l'utilisateur pour Get iT AI (§15-16) : objectifs, quêtes du jour,
 * habitudes, scores, niveau et check-ins récents, résumés et bornés. Renvoie
 * aussi les objectifs avec leur référence courte (G1…), pour relier les
 * propositions du coach au bon objectif.
 */
export async function buildCoachContext(
  userId: string,
  profile: ContextProfile,
): Promise<{ text: string; today: string; goals: GoalRef[] }> {
  const today = toCalendarDay(new Date(), profile.timeZone);
  const scoreDays = scoreWindow(today);
  const [habits, tasks, recentTasks, assessments, xp, checkIns, goals] =
    await Promise.all([
      listHabits(userId, profile.timeZone),
      listDayTasks(userId, today),
      listGoalTasksDueBetween(userId, scoreDays.from, scoreDays.to),
      getLatestAssessments(userId),
      getXpTotals(userId),
      listCheckIns(userId, addDays(today, -6), today),
      listActiveGoalPlans(userId),
    ]);

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
    level: {
      level: levelFromXp(xp.total).level,
      xp: xp.total,
      pillarLevels: Object.fromEntries(
        PILLARS.map((pillar) => [
          pillar,
          levelFromXp(xp.pillars[pillar]).level,
        ]),
      ) as Record<Pillar, number>,
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
