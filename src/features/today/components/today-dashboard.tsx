import { Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TaskList } from "@/features/tasks/components/task-list";
import { Link } from "@/i18n/navigation";
import { toCalendarDay } from "@/lib/dates";
import { getCheckIn } from "@/server/check-ins/service";
import { listHabits } from "@/server/habits/service";
import { getCurrentProfile } from "@/server/profile/service";
import { listDayTasks } from "@/server/tasks/service";
import { getDayPlan } from "../day-plan";
import { CheckInCard } from "./check-in-card";
import { DayProgress } from "./day-progress";
import { TodayHabits } from "./today-habits";

/**
 * Le plan du jour : avancement, check-in, habitudes prévues et tâches.
 * Lit la session : à placer dans un <Suspense>.
 */
export async function TodayDashboard() {
  const profile = await getCurrentProfile();
  // L'heure courante est lue après la session : jamais pendant le prérendu
  const today = toCalendarDay(new Date(), profile.timeZone);
  const [habits, tasks, checkIn, t] = await Promise.all([
    listHabits(profile.id, profile.timeZone),
    listDayTasks(profile.id, today),
    getCheckIn(profile.id, today),
    getTranslations("Today"),
  ]);
  const { habitsToday, progress } = getDayPlan({ habits, tasks, today });

  return (
    <div className="flex flex-col gap-8">
      <DayProgress {...progress} />
      <CheckInCard saved={checkIn} />

      <div className="grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="today-habits" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2
              id="today-habits"
              className="font-heading text-lg font-semibold"
            >
              {t("habits.title")}
            </h2>
            <Link
              href="/habits"
              className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              {t("habits.link")}
            </Link>
          </div>
          {habitsToday.length > 0 ? (
            <TodayHabits habits={habitsToday} today={today} />
          ) : habits.some((habit) => !habit.archived) ? (
            <p className="text-sm text-muted-foreground">
              {t("habits.nonePlanned")}
            </p>
          ) : (
            <div className="flex flex-col items-start gap-3">
              <p className="text-sm text-muted-foreground">
                {t("habits.noHabits")}
              </p>
              <Button asChild variant="outline" size="sm">
                <Link href="/habits/new">
                  <Plus aria-hidden="true" />
                  {t("habits.create")}
                </Link>
              </Button>
            </div>
          )}
        </section>

        <section aria-labelledby="today-tasks" className="flex flex-col gap-4">
          <h2 id="today-tasks" className="font-heading text-lg font-semibold">
            {t("tasks.title")}
          </h2>
          <TaskList
            goalId={null}
            tasks={tasks}
            today={today}
            emptyMessage={t("tasks.empty")}
            defaultDueDate={today}
          />
        </section>
      </div>
    </div>
  );
}

export function TodayDashboardSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <Skeleton className="h-24 rounded-xl" />
      <Skeleton className="h-40 rounded-xl" />
      <div className="grid gap-8 lg:grid-cols-2">
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    </div>
  );
}
