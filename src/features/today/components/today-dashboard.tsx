import { getLocale, getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui/skeleton";
import { ONBOARDING_PATH } from "@/features/auth/access";
import { computeStreaks } from "@/features/habits/streak";
import { habitDayXp, XP_REWARDS } from "@/features/xp/rules";
import { redirect } from "@/i18n/navigation";
import { toCalendarDay } from "@/lib/dates";
import { getDayPeriod } from "@/lib/day-period";
import { getCheckIn } from "@/server/check-ins/service";
import { listHabits } from "@/server/habits/service";
import {
  getCurrentProfile,
  getLatestAssessments,
  type CurrentProfile,
} from "@/server/profile/service";
import { listDayTasks, listGoalTasksDueBetween } from "@/server/tasks/service";
import { getTaskXp, getTaskXpLeft, getXpTotals } from "@/server/xp/service";
import { selectHabitsToday } from "../day-plan";
import { formatDayStamp } from "../day-stamp";
import { computePillarScores, scoreWindow } from "../pillar-scores";
import { CheckInCard } from "./check-in-card";
import { TodayBoard } from "./today-board";

/**
 * Le plan du jour : salutation et niveau, orbite des piliers, quêtes (habitudes
 * et tâches) et check-in. Lit la session : à placer dans un <Suspense>.
 */
export async function TodayDashboard() {
  const profile = await getCurrentProfile();
  // Page d'arrivée après la connexion : l'onboarding doit être terminé
  if (!profile.onboardedAt) {
    redirect({ href: ONBOARDING_PATH, locale: await getLocale() });
  }
  // L'heure courante est lue après la session : jamais pendant le prérendu
  const now = new Date();
  const today = toCalendarDay(now, profile.timeZone);
  const scoreDays = scoreWindow(today);
  const [
    habits,
    tasks,
    recentTasks,
    assessments,
    checkIn,
    xpTotals,
    taskXpLeft,
  ] = await Promise.all([
    listHabits(profile.id, profile.timeZone),
    listDayTasks(profile.id, today),
    listGoalTasksDueBetween(profile.id, scoreDays.from, scoreDays.to),
    getLatestAssessments(profile.id),
    getCheckIn(profile.id, today),
    getXpTotals(profile.id),
    getTaskXpLeft(profile.id, today),
  ]);
  const taskXp = await getTaskXp(
    profile.id,
    tasks.filter((task) => task.done).map((task) => task.id),
  );

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

  // XP de chaque quête : gagnée si elle est faite, à gagner sinon (plafond des tâches)
  const questXp: Record<string, number> = {};
  for (const habit of habitsToday) {
    questXp[`habit:${habit.id}`] = habitDayXp(habit.weekdays, today);
  }
  for (const task of tasks) {
    questXp[`task:${task.id}`] = task.done
      ? (taskXp.get(task.id) ?? 0)
      : taskXpLeft > 0
        ? XP_REWARDS.task
        : 0;
  }

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
      hasHabits={active.length > 0}
      xp={{ total: xpTotals.total, quests: questXp }}
      initial={(profile.displayName ?? profile.email ?? "").charAt(0)}
      greeting={<TodayGreeting profile={profile} now={now} />}
      checkIn={<CheckInCard saved={checkIn} />}
    />
  );
}

/** « JEU · 08 OCT » puis « Bonsoir, Max. », selon l'heure dans le fuseau de l'utilisateur. */
async function TodayGreeting({
  profile,
  now,
}: {
  profile: CurrentProfile;
  now: Date;
}) {
  const [t, locale] = await Promise.all([
    getTranslations("App.today"),
    getLocale(),
  ]);

  return (
    <header className="flex min-w-0 flex-col gap-1.5">
      <time
        dateTime={toCalendarDay(now, profile.timeZone)}
        className="font-mono text-xs tracking-[0.16em] text-muted-foreground"
      >
        {formatDayStamp(now, locale, profile.timeZone)}
      </time>
      <h1 className="font-heading text-3xl leading-tight font-bold tracking-tight text-balance sm:text-4xl">
        {t("greeting", {
          period: getDayPeriod(now, profile.timeZone),
          name: profile.displayName ?? "",
        })}
      </h1>
      <p className="text-sm text-muted-foreground">{t("question")}</p>
    </header>
  );
}

export function TodayDashboardSkeleton() {
  return (
    <div className="flex flex-col gap-5 lg:gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-9 w-56 max-w-full sm:h-10" />
          <Skeleton className="h-5 w-52 max-w-full" />
        </div>
        <Skeleton className="size-12 shrink-0 rounded-full" />
      </div>
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
    </div>
  );
}
