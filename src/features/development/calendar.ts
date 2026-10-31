import { z } from "zod";
import {
  DAY_MOMENTS,
  minuteOfDaySchema,
  momentOfMinute,
  type DayMoment,
} from "@/config/moments";
import { occursOn, type CalendarEvent } from "@/features/events/rules";
import {
  itemTitleSchema,
  optionalDaySchema,
  recordIdSchema,
} from "@/features/goals/schemas";
import { addDays, daysBetween, isoWeekday } from "@/lib/dates";
import type { DevelopmentPlan } from "./plan";
import { DEVELOPMENT_KINDS, type DevelopmentKind } from "./questionnaires";

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
  moment: DayMoment | null;
  /** Heure prévue (minutes depuis minuit) ; null : pas d'heure. */
  time: number | null;
  planKind: DevelopmentKind | null;
};

export type CalendarHabit = {
  id: string;
  title: string;
  weekdays: number[];
  moment: DayMoment | null;
  /** Heure prévue (minutes depuis minuit) ; null : pas d'heure. */
  time: number | null;
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
  /** Événements personnels (calendrier principal seulement). */
  events: CalendarEvent[];
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
    events: data.events
      .filter((event) => occursOn(event, day))
      .sort((a, b) => a.startMinute - b.startMinute),
  };
}

/**
 * Jours marqués d'un point : une séance, une tâche, un objectif ou un
 * événement. Les habitudes n'en ont pas (elles reviennent presque chaque jour).
 */
export function markedDays(data: CalendarData): Set<string> {
  const { first, last } = monthRange(data.month);
  const marked = new Set<string>();
  for (let day = first; day <= last; day = addDays(day, 1)) {
    if (data.plans.some((plan) => sessionOn(plan, day))) marked.add(day);
    if (data.events.some((event) => occursOn(event, day))) marked.add(day);
  }
  for (const task of data.tasks) marked.add(task.dueDate);
  for (const goal of data.goals) marked.add(goal.targetDate);
  return marked;
}

/** Les 7 jours (lundi à dimanche) de la semaine qui contient `day`. */
export function weekOf(day: string): string[] {
  const monday = addDays(day, 1 - isoWeekday(day));
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}

/**
 * Où en est un plan : semaine en cours et nombre de semaines. Null avant son
 * début ; après sa fin, la dernière semaine.
 */
export function planWeek(
  plan: Pick<CalendarPlan, "startsOn" | "endsOn">,
  today: string,
): { week: number; weeks: number } | null {
  if (today < plan.startsOn) return null;
  const weeks = Math.max(
    1,
    Math.ceil((daysBetween(plan.startsOn, plan.endsOn) + 1) / 7),
  );
  const week = Math.floor(daysBetween(plan.startsOn, today) / 7) + 1;
  return { week: Math.min(week, weeks), weeks };
}

type Session = CalendarPlan["schedule"][number];

/** Un élément du jour, dans la vue « Semaine ». */
export type TimelineItem =
  | { type: "session"; key: string; plan: CalendarPlan; session: Session }
  | { type: "habit"; key: string; habit: CalendarHabit; done: boolean }
  | { type: "task"; key: string; task: CalendarTask }
  | { type: "goal"; key: string; goal: CalendarGoal }
  | { type: "event"; key: string; event: CalendarEvent };

export type TimelineGroup = {
  /** Null : « dans la journée », sans moment choisi. */
  moment: DayMoment | null;
  items: TimelineItem[];
};

/** Heure d'un élément du jour (minutes depuis minuit) ; null : pas d'heure. */
export function timeOfItem(item: TimelineItem): number | null {
  switch (item.type) {
    case "session":
      return item.session.time;
    case "habit":
      return item.habit.time;
    case "task":
      return item.task.time;
    case "goal":
      return null;
    case "event":
      return item.event.startMinute;
  }
}

/** Un élément qui a une heure est rangé par elle ; sinon par son moment choisi. */
const momentOfItem = (item: TimelineItem): DayMoment | null => {
  const time = timeOfItem(item);
  if (time !== null) return momentOfMinute(time);
  switch (item.type) {
    case "session":
      return item.session.moment;
    case "habit":
      return item.habit.moment;
    case "task":
      return item.task.moment;
    default:
      return null;
  }
};

/**
 * Le jour en moments : matin, midi, soir, puis « dans la journée » pour ce qui
 * n'a pas de moment. Dans chaque moment : ce qui a une heure, dans l'ordre des
 * heures, puis séances, habitudes, tâches et objectifs. Les moments vides sont omis.
 */
export function dayTimeline(
  entries: ReturnType<typeof dayEntries>,
): TimelineGroup[] {
  const items: TimelineItem[] = [
    ...entries.events.map((event): TimelineItem => ({
      type: "event",
      key: `event:${event.id}`,
      event,
    })),
    ...entries.sessions.map(({ plan, session }): TimelineItem => ({
      type: "session",
      key: `session:${plan.id}`,
      plan,
      session,
    })),
    ...entries.habits.map(({ habit, done }): TimelineItem => ({
      type: "habit",
      key: `habit:${habit.id}`,
      habit,
      done,
    })),
    ...entries.tasks.map((task): TimelineItem => ({
      type: "task",
      key: `task:${task.id}`,
      task,
    })),
    ...entries.goals.map((goal): TimelineItem => ({
      type: "goal",
      key: `goal:${goal.id}`,
      goal,
    })),
  ];
  // Tri stable : sans heure, l'ordre de la liste ci-dessus est gardé
  const byTime = (a: TimelineItem, b: TimelineItem) =>
    (timeOfItem(a) ?? Infinity) - (timeOfItem(b) ?? Infinity);
  return [...DAY_MOMENTS, null]
    .map((moment) => ({
      moment,
      items: items.filter((item) => momentOfItem(item) === moment).sort(byTime),
    }))
    .filter((group) => group.items.length > 0);
}

const momentSchema = z.enum(DAY_MOMENTS).nullable();
const kindSchema = z.enum(DEVELOPMENT_KINDS);
const weekdaySchema = z.number().int().min(1).max(7);

/**
 * « Modifier » dans le calendrier (glisser, ou le bouton horloge) : l'heure,
 * ou à défaut le moment ; pour une tâche, aussi son titre et son échéance.
 * Revalidé par le serveur. Une heure range l'élément : le moment en découle.
 */
export const itemEditSchema = z
  .discriminatedUnion("type", [
    z.object({
      type: z.literal("task"),
      id: recordIdSchema,
      title: itemTitleSchema,
      dueDate: optionalDaySchema,
      time: minuteOfDaySchema.nullable(),
      moment: momentSchema,
    }),
    z.object({
      type: z.literal("habit"),
      id: recordIdSchema,
      time: minuteOfDaySchema.nullable(),
      moment: momentSchema,
    }),
    z.object({
      type: z.literal("session"),
      kind: kindSchema,
      weekday: weekdaySchema,
      time: minuteOfDaySchema.nullable(),
      moment: momentSchema,
    }),
  ])
  .transform((input) => ({
    ...input,
    moment: input.time === null ? input.moment : momentOfMinute(input.time),
  }));

export type ItemEdit = z.input<typeof itemEditSchema>;

/** « Supprimer » dans le calendrier : l'élément visé, revalidé par le serveur. */
export const calendarTargetSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.enum(["task", "habit", "goal", "event"]),
    id: recordIdSchema,
  }),
  z.object({
    type: z.literal("session"),
    kind: kindSchema,
    weekday: weekdaySchema,
  }),
]);

export type CalendarTarget = z.infer<typeof calendarTargetSchema>;
