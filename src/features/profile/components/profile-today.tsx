import { Skeleton } from "@/components/ui/skeleton";
import { CheckInCard } from "@/features/today/components/check-in-card";
import { SystemOrbit } from "@/features/today/components/system-orbit";
import {
  selectHabitsToday,
  summarizePlannedDay,
} from "@/features/today/day-plan";
import {
  computePillarScores,
  scoreWindow,
} from "@/features/today/pillar-scores";
import { toCalendarDay } from "@/lib/dates";
import { getCheckIn } from "@/server/check-ins/service";
import { listHabits } from "@/server/habits/service";
import {
  getCurrentProfile,
  getLatestAssessments,
} from "@/server/profile/service";
import { listDayTasks, listGoalTasksDueBetween } from "@/server/tasks/service";

/**
 * Le système de l'utilisateur (score de chaque pilier, avancement du jour) et
 * son check-in du jour. Lit la session : à placer dans un <Suspense>.
 */
export async function ProfileToday() {
  const profile = await getCurrentProfile();
  // L'heure courante est lue après la session : jamais pendant le prérendu
  const today = toCalendarDay(new Date(), profile.timeZone);
  const window = scoreWindow(today);
  const [habits, tasks, recentTasks, assessments, checkIn] = await Promise.all([
    listHabits(profile.id, profile.timeZone),
    listDayTasks(profile.id, today),
    listGoalTasksDueBetween(profile.id, window.from, window.to),
    getLatestAssessments(profile.id),
    getCheckIn(profile.id, today),
  ]);
  const summary = summarizePlannedDay({
    habits: selectHabitsToday(habits, today),
    tasks,
    today,
  });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <SystemOrbit
        scores={computePillarScores({
          habits,
          tasks: recentTasks,
          assessments,
          today,
        })}
        day={summary.day}
        pillars={summary.pillars}
        filter={null}
      />
      <div className="lg:self-start">
        <CheckInCard saved={checkIn} />
      </div>
    </div>
  );
}

export function ProfileTodaySkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Skeleton className="aspect-[322/330] w-full rounded-3xl" />
      <Skeleton className="h-64 rounded-3xl" />
    </div>
  );
}
