import "server-only";
import { selectHabitsToday } from "@/features/today/day-plan";
import { habitDayXp, XP_REWARDS } from "@/features/xp/rules";
import { fromDbDate, toCalendarDay, toDbDate } from "@/lib/dates";
import { db } from "@/server/db";
import { listHabits, type HabitSummary } from "@/server/habits/service";
import { getUserTimeZone } from "@/server/profile/service";
import { pactTagsForHabits, type PactTag } from "@/server/messages/pacts";
import { listDayTasks, type DayTask } from "@/server/tasks/service";
import { getTaskXp, getTaskXpLeft, getXpTotals } from "@/server/xp/service";

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
   * XP totale enregistrée, et XP de chaque élément (« habit:<id> », « task:<id> ») :
   * gagnée s'il est fait, à gagner sinon.
   */
  xp: { total: number; items: Record<string, number> };
};

export async function getDayPlan(
  userId: string,
  timeZone: string,
  now: Date,
): Promise<DayPlan> {
  const today = toCalendarDay(now, timeZone);
  const [habits, tasks, xpTotals, taskXpLeft] = await Promise.all([
    listHabits(userId, timeZone),
    listDayTasks(userId, today, timeZone),
    getXpTotals(userId),
    getTaskXpLeft(userId, today),
  ]);
  const taskXp = await getTaskXp(
    userId,
    tasks.filter((task) => task.done).map((task) => task.id),
  );

  const habitsToday = selectHabitsToday(habits, today);
  const pacts = await pactTagsForHabits(
    userId,
    habitsToday.map((habit) => habit.id),
    today,
  );
  const items: Record<string, number> = {};
  for (const habit of habitsToday) {
    items[`habit:${habit.id}`] = habitDayXp(habit.weekdays, today);
  }
  for (const task of tasks) {
    // Au-delà du plafond quotidien, une tâche ne rapporte plus d'XP
    items[`task:${task.id}`] = task.done
      ? (taskXp.get(task.id) ?? 0)
      : taskXpLeft > 0
        ? XP_REWARDS.task
        : 0;
  }

  return {
    today,
    habits: habitsToday,
    tasks,
    pacts,
    xp: { total: xpTotals.total, items },
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
