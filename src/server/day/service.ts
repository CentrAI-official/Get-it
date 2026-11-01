import "server-only";
import { dayStreak, streakBefore } from "@/features/streaks/rules";
import { selectHabitsToday } from "@/features/today/day-plan";
import { fromDbDate, toCalendarDay, toDbDate } from "@/lib/dates";
import { db } from "@/server/db";
import { listHabits, type HabitSummary } from "@/server/habits/service";
import { getUserTimeZone } from "@/server/profile/service";
import { pactTagsForHabits, type PactTag } from "@/server/messages/pacts";
import { getActivity } from "@/server/streaks/service";
import { listDayTasks, type DayTask } from "@/server/tasks/service";

// « Ma journée » : ce qui est prévu aujourd'hui, à cocher depuis n'importe
// quelle page. Chaque fonction reçoit l'userId de la session.

export type DayPlan = {
  /** Aujourd'hui, dans le fuseau de l'utilisateur. */
  today: string;
  /** Habitudes prévues aujourd'hui. */
  habits: HabitSummary[];
  /** Tâches dues aujourd'hui et tâches en retard. */
  tasks: DayTask[];
  /** Pactes en cours des habitudes du jour (« habitId » → étiquette). */
  pacts: Record<string, PactTag>;
  /**
   * Série du jour : jours actifs d'affilée jusqu'à hier, si aujourd'hui est
   * déjà actif (une action, même hors de cette liste) et le record.
   */
  streak: { before: number; activeToday: boolean; best: number };
};

export async function getDayPlan(
  userId: string,
  timeZone: string,
  now: Date,
): Promise<DayPlan> {
  const today = toCalendarDay(now, timeZone);
  const [habits, tasks, activity] = await Promise.all([
    listHabits(userId, timeZone),
    listDayTasks(userId, today, timeZone),
    getActivity(userId, timeZone),
  ]);

  const habitsToday = selectHabitsToday(habits, today);
  const pacts = await pactTagsForHabits(
    userId,
    habitsToday.map((habit) => habit.id),
    today,
  );

  return {
    today,
    habits: habitsToday,
    tasks,
    pacts,
    streak: {
      before: streakBefore(activity.days, today),
      activeToday: activity.days.includes(today),
      best: dayStreak(activity.days, today).best,
    },
  };
}

/** Vrai si « Ma journée » ne s'est pas encore ouvert tout seul aujourd'hui. */
export async function isDayPanelDue(userId: string, today: string) {
  const settings = await db.userSettings.findUnique({
    where: { userId },
    select: { dayPanelSeenOn: true },
  });
  const seen = settings?.dayPanelSeenOn;
  return !seen || fromDbDate(seen) !== today;
}

/** « Ma journée » s'est ouvert aujourd'hui : il ne s'ouvrira plus tout seul avant demain. */
export async function markDayPanelSeen(userId: string) {
  const timeZone = await getUserTimeZone(userId);
  const day = toDbDate(toCalendarDay(new Date(), timeZone));
  await db.userSettings.upsert({
    where: { userId },
    update: { dayPanelSeenOn: day },
    create: { userId, dayPanelSeenOn: day },
  });
}
