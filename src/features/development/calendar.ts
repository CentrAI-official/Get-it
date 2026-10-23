import { addDays, isoWeekday } from "@/lib/dates";
import type { DevelopmentPlan } from "./plan";
import type { DevelopmentKind } from "./questionnaires";

// Calendrier de « Mon développement » : la semaine type de chaque plan se
// répète sur sa période ; les tâches tombent à leur échéance, les objectifs à
// leur date visée, les habitudes les jours prévus. Fonctions pures, testées.

/** Mois affiché, « AAAA-MM ». */
export type Month = string;

export type CalendarPlan = {
  id: string;
  kind: DevelopmentKind;
  title: string;
  startsOn: string;
  endsOn: string;
  schedule: DevelopmentPlan["schedule"];
};

export type CalendarTask = {
  id: string;
  title: string;
  dueDate: string;
  done: boolean;
  planKind: DevelopmentKind | null;
};

export type CalendarHabit = {
  id: string;
  title: string;
  weekdays: number[];
  /** Premier jour suivi (création) et jour de la mise en pause, s'il y en a une. */
  from: string;
  until: string | null;
  /** Jours cochés dans le mois chargé. */
  doneDays: string[];
  planKind: DevelopmentKind | null;
};

export type CalendarGoal = {
  id: string;
  title: string;
  targetDate: string;
  done: boolean;
  planKind: DevelopmentKind | null;
};

export type CalendarData = {
  month: Month;
  today: string;
  plans: CalendarPlan[];
  tasks: CalendarTask[];
  habits: CalendarHabit[];
  goals: CalendarGoal[];
};

export const monthOf = (day: string): Month => day.slice(0, 7);

/** Durée d'un plan sans date visée : 12 semaines. */
export const DEFAULT_PLAN_DAYS = 84;
/** Durée maximale d'un plan dans le calendrier : 5 ans. */
export const MAX_PLAN_DAYS = 1825;

/**
 * Période d'un plan qui commence aujourd'hui : jusqu'à la date visée du
 * questionnaire (si elle est à venir), sinon celle de l'objectif proposé,
 * sinon 12 semaines.
 */
export function planPeriod(
  today: string,
  targetDate: unknown,
  goalInDays: number | null,
) {
  const max = addDays(today, MAX_PLAN_DAYS);
  if (
    typeof targetDate === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(targetDate) &&
    targetDate > today
  ) {
    return { startsOn: today, endsOn: targetDate < max ? targetDate : max };
  }
  const days = Math.min(
    MAX_PLAN_DAYS,
    Math.max(7, goalInDays ?? DEFAULT_PLAN_DAYS),
  );
  return { startsOn: today, endsOn: addDays(today, days) };
}

/** Premier et dernier jour d'un mois. */
export function monthRange(month: Month) {
  const [year, monthIndex] = month.split("-").map(Number) as [number, number];
  const last = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();
  return {
    first: `${month}-01`,
    last: `${month}-${String(last).padStart(2, "0")}`,
  };
}

/** Mois décalé de `delta` (−1 : le précédent). */
export function addMonths(month: Month, delta: number): Month {
  const [year, monthIndex] = month.split("-").map(Number) as [number, number];
  const date = new Date(Date.UTC(year, monthIndex - 1 + delta, 1));
  return date.toISOString().slice(0, 7);
}

/** Semaines du mois, du lundi au dimanche ; null hors du mois. */
export function monthGrid(month: Month): (string | null)[][] {
  const { first, last } = monthRange(month);
  const weeks: (string | null)[][] = [];
  let week: (string | null)[] = Array.from(
    { length: isoWeekday(first) - 1 },
    () => null,
  );
  for (let day = first; day <= last; day = addDays(day, 1)) {
    week.push(day);
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length > 0) {
    weeks.push([
      ...week,
      ...Array.from({ length: 7 - week.length }, () => null),
    ]);
  }
  return weeks;
}

/** La séance d'un plan ce jour-là, s'il est dans sa période. */
export function sessionOn(plan: CalendarPlan, day: string) {
  if (day < plan.startsOn || day > plan.endsOn) return null;
  return (
    plan.schedule.find((entry) => entry.weekday === isoWeekday(day)) ?? null
  );
}

const habitActive = (habit: CalendarHabit, day: string) =>
  day >= habit.from &&
  (habit.until === null || day < habit.until) &&
  habit.weekdays.includes(isoWeekday(day));

/** Tout ce qui est prévu un jour donné. */
export function dayEntries(data: CalendarData, day: string) {
  return {
    sessions: data.plans.flatMap((plan) => {
      const session = sessionOn(plan, day);
      return session ? [{ plan, session }] : [];
    }),
    goals: data.goals.filter((goal) => goal.targetDate === day),
    tasks: data.tasks.filter((task) => task.dueDate === day),
    habits: data.habits
      .filter((habit) => habitActive(habit, day))
      .map((habit) => ({ habit, done: habit.doneDays.includes(day) })),
  };
}

/**
 * Jours marqués d'un point : une séance, une tâche ou un objectif. Les
 * habitudes n'en ont pas (elles reviennent presque chaque jour).
 */
export function markedDays(data: CalendarData): Set<string> {
  const { first, last } = monthRange(data.month);
  const marked = new Set<string>();
  for (let day = first; day <= last; day = addDays(day, 1)) {
    if (data.plans.some((plan) => sessionOn(plan, day))) marked.add(day);
  }
  for (const task of data.tasks) marked.add(task.dueDate);
  for (const goal of data.goals) marked.add(goal.targetDate);
  return marked;
}
