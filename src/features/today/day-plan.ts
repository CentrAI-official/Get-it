import { isoWeekday } from "@/lib/dates";

type PlannedHabit = {
  weekdays: readonly number[];
  completions: readonly string[];
  archived: boolean;
};
type PlannedTask = { dueDate: string | null; done: boolean };

/**
 * Le plan du jour : habitudes prévues aujourd'hui et avancement de la journée.
 * L'avancement compte les habitudes prévues et les tâches dues aujourd'hui ;
 * les tâches en retard sont affichées à part, sans gonfler le total.
 */
export function getDayPlan<H extends PlannedHabit, T extends PlannedTask>({
  habits,
  tasks,
  today,
}: {
  habits: readonly H[];
  tasks: readonly T[];
  today: string;
}) {
  const weekday = isoWeekday(today);
  const habitsToday = habits.filter(
    (habit) => !habit.archived && habit.weekdays.includes(weekday),
  );
  const tasksToday = tasks.filter((task) => task.dueDate === today);

  const total = habitsToday.length + tasksToday.length;
  const done =
    habitsToday.filter((habit) => habit.completions.includes(today)).length +
    tasksToday.filter((task) => task.done).length;

  return { habitsToday, progress: { done, total } };
}
