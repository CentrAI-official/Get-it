import { Skeleton } from "@/components/ui/skeleton";
import { computeStreaks } from "@/features/habits/streak";
import { toCalendarDay } from "@/lib/dates";
import { getCheckIn } from "@/server/check-ins/service";
import { listHabits } from "@/server/habits/service";
import {
  getCurrentProfile,
  getLatestAssessments,
} from "@/server/profile/service";
import { listDayTasks, listGoalTasksDueBetween } from "@/server/tasks/service";
import { selectHabitsToday } from "../day-plan";
import { computePillarScores, scoreWindow } from "../pillar-scores";
import { CheckInCard } from "./check-in-card";
import { TodayBoard } from "./today-board";

/**
 * Le plan du jour : orbite des piliers, quêtes (habitudes et tâches) et check-in.
 * Lit la session : à placer dans un <Suspense>.
 */
export async function TodayDashboard() {
  const profile = await getCurrentProfile();
  // L'heure courante est lue après la session : jamais pendant le prérendu
  const today = toCalendarDay(new Date(), profile.timeZone);
  const scoreDays = scoreWindow(today);
  const [habits, tasks, recentTasks, assessments, checkIn] = await Promise.all([
    listHabits(profile.id, profile.timeZone),
    listDayTasks(profile.id, today),
    listGoalTasksDueBetween(profile.id, scoreDays.from, scoreDays.to),
    getLatestAssessments(profile.id),
    getCheckIn(profile.id, today),
  ]);

  const habitsToday = selectHabitsToday(habits, today);
  const plannedToday = new Set(habitsToday.map((habit) => habit.id));
  const active = habits.filter((habit) => !habit.archived);
  // Les séries des habitudes du jour sont recalculées à chaque clic, côté client
  const otherStreak = Math.max(
    0,
    ...active
      .filter((habit) => !plannedToday.has(habit.id))
      .map(
        (habit) =>
          computeStreaks({
            weekdays: habit.weekdays,
            completions: new Set(habit.completions),
            startDay: habit.startDay,
            today,
          }).current,
      ),
  );

  return (
    <TodayBoard
      today={today}
      habits={habitsToday}
      tasks={tasks}
      scores={computePillarScores({
        habits,
        tasks: recentTasks,
        assessments,
        today,
      })}
      otherStreak={otherStreak}
      energy={checkIn?.energy ?? null}
      hasHabits={active.length > 0}
      checkIn={<CheckInCard saved={checkIn} />}
    />
  );
}

export function TodayDashboardSkeleton() {
  return (
    <div className="grid gap-5 lg:grid-cols-[5fr_6fr] lg:gap-6">
      <div className="flex flex-col gap-5">
        <Skeleton className="aspect-[322/360] w-full rounded-3xl" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-[74px] rounded-2xl" />
          <Skeleton className="h-[74px] rounded-2xl" />
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-7 w-40" />
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-[62px] rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
