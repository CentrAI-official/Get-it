import { z } from "zod";
import {
  DAY_MOMENTS,
  asDayMoment,
  minuteOfDaySchema,
  type DayMoment,
} from "@/config/moments";
import {
  GOAL_TITLE_MAX_LENGTH,
  ITEM_TITLE_MAX_LENGTH,
} from "@/features/goals/schemas";
import { HABIT_TITLE_MAX_LENGTH, WEEKDAYS } from "@/features/habits/schemas";

/** Titre d'une séance de la semaine type. */
export const SESSION_TITLE_MAX_LENGTH = 80;

/** Taille d'un plan de « Mon développement » : complet, mais lisible sur un téléphone. */
export const DEVELOPMENT_PLAN_LIMITS = {
  highlights: 6,
  scheduleDays: 7,
  itemsPerDay: 10,
  sections: 6,
  itemsPerSection: 8,
  habits: 3,
  tasks: 5,
  /** Les premières tâches tombent dans les 30 prochains jours. */
  taskHorizonDays: 30,
  /** Date cible de l'objectif proposé : entre 1 semaine et 5 ans. */
  goalMinDays: 7,
  goalMaxDays: 5 * 365,
} as const;

/** Plans de « Mon développement » générés par jour (dans la limite de Get iT AI). */
export const DAILY_DEVELOPMENT_PLANS = 3;

const item = z.object({ title: z.string(), detail: z.string() });

/**
 * Sortie structurée demandée au modèle. Volontairement simple (pas de bornes) :
 * les limites sont appliquées ensuite par `normalizeDevelopmentPlan`.
 */
export const aiDevelopmentPlanSchema = z.object({
  /** Détresse détectée : pas de plan, l'application montre des ressources d'aide. */
  crisis: z.boolean(),
  title: z.string(),
  summary: z.string(),
  highlights: z.array(z.object({ label: z.string(), value: z.string() })),
  /** Semaine type : 1 (lundi) à 7 (dimanche), et le moment de la journée. */
  schedule: z.array(
    z.object({
      weekday: z.number().int(),
      moment: z.enum(DAY_MOMENTS).nullable(),
      title: z.string(),
      items: z.array(z.object({ name: z.string(), detail: z.string() })),
    }),
  ),
  sections: z.array(z.object({ title: z.string(), items: z.array(item) })),
  goal: z
    .object({ title: z.string(), targetInDays: z.number().int() })
    .nullable(),
  habits: z.array(
    z.object({
      title: z.string(),
      weekdays: z.array(z.number().int()),
      moment: z.enum(DAY_MOMENTS).nullable(),
    }),
  ),
  tasks: z.array(z.object({ title: z.string(), dueInDays: z.number().int() })),
  caution: z.string(),
});

export type AiDevelopmentPlan = z.infer<typeof aiDevelopmentPlanSchema>;

export type DevelopmentPlan = {
  title: string;
  summary: string;
  highlights: { label: string; value: string }[];
  schedule: {
    weekday: number;
    /** Null : dans la journée (plans créés avant les moments, ou sans préférence). */
    moment: DayMoment | null;
    /** Heure choisie par l'utilisateur (minutes depuis minuit) ; null : pas d'heure. */
    time: number | null;
    title: string;
    items: { name: string; detail: string }[];
  }[];
  sections: { title: string; items: { title: string; detail: string }[] }[];
  goal: { title: string; targetInDays: number } | null;
  habits: { title: string; weekdays: number[]; moment: DayMoment | null }[];
  tasks: { title: string; dueInDays: number }[];
  caution: string;
};

const clean = (text: string, max: number) =>
  text.replace(/\s+/g, " ").trim().slice(0, max).trim();

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Math.round(value)));

function uniqueBy<T>(items: T[], key: (item: T) => string, limit: number) {
  const seen = new Set<string>();
  return items
    .filter((entry) => {
      const value = key(entry).toLocaleLowerCase();
      if (!value || seen.has(value)) return false;
      seen.add(value);
      return true;
    })
    .slice(0, limit);
}

const validWeekdays = (days: number[]) => {
  const list = [...new Set(days)]
    .filter((day) => WEEKDAYS.includes(day as (typeof WEEKDAYS)[number]))
    .sort((a, b) => a - b);
  return list.length > 0 ? list : [...WEEKDAYS];
};

/**
 * Plan prêt à afficher et à enregistrer : textes nettoyés et raccourcis,
 * doublons retirés, nombres d'éléments plafonnés, jours et échéances valides.
 * Null si le modèle a signalé une détresse ou si le plan est vide.
 */
export function normalizeDevelopmentPlan(
  raw: AiDevelopmentPlan,
): DevelopmentPlan | null {
  if (raw.crisis) return null;
  const L = DEVELOPMENT_PLAN_LIMITS;
  const plan: DevelopmentPlan = {
    title: clean(raw.title, 100),
    summary: raw.summary.trim().slice(0, 1200),
    highlights: raw.highlights
      .map((entry) => ({
        label: clean(entry.label, 60),
        value: clean(entry.value, 80),
      }))
      .filter((entry) => entry.label && entry.value)
      .slice(0, L.highlights),
    schedule: uniqueBy(
      raw.schedule.filter((day) =>
        WEEKDAYS.includes(day.weekday as (typeof WEEKDAYS)[number]),
      ),
      (day) => String(day.weekday),
      L.scheduleDays,
    )
      .map((day) => ({
        weekday: day.weekday,
        moment: asDayMoment(day.moment),
        // L'heure se choisit ensuite dans le calendrier
        time: null,
        title: clean(day.title, SESSION_TITLE_MAX_LENGTH),
        items: day.items
          .map((entry) => ({
            name: clean(entry.name, 100),
            detail: clean(entry.detail, 200),
          }))
          .filter((entry) => entry.name)
          .slice(0, L.itemsPerDay),
      }))
      .sort((a, b) => a.weekday - b.weekday),
    sections: raw.sections
      .map((section) => ({
        title: clean(section.title, 80),
        items: section.items
          .map((entry) => ({
            title: clean(entry.title, 100),
            detail: clean(entry.detail, 400),
          }))
          .filter((entry) => entry.title || entry.detail)
          .slice(0, L.itemsPerSection),
      }))
      .filter((section) => section.title && section.items.length > 0)
      .slice(0, L.sections),
    goal:
      raw.goal && clean(raw.goal.title, GOAL_TITLE_MAX_LENGTH)
        ? {
            title: clean(raw.goal.title, GOAL_TITLE_MAX_LENGTH),
            targetInDays: clamp(
              raw.goal.targetInDays,
              L.goalMinDays,
              L.goalMaxDays,
            ),
          }
        : null,
    habits: uniqueBy(
      raw.habits.map((habit) => ({
        title: clean(habit.title, HABIT_TITLE_MAX_LENGTH),
        weekdays: validWeekdays(habit.weekdays),
        moment: asDayMoment(habit.moment),
      })),
      (habit) => habit.title,
      L.habits,
    ),
    tasks: uniqueBy(
      raw.tasks.map((task) => ({
        title: clean(task.title, ITEM_TITLE_MAX_LENGTH),
        dueInDays: clamp(task.dueInDays, 0, L.taskHorizonDays),
      })),
      (task) => task.title,
      L.tasks,
    ),
    caution: raw.caution.trim().slice(0, 400),
  };
  const empty =
    !plan.title || (plan.schedule.length === 0 && plan.sections.length === 0);
  return empty ? null : plan;
}

/** Titre comparé sans casse ni espaces superflus. */
const titleKey = (title: string) =>
  title.replace(/s+/g, " ").trim().toLocaleLowerCase();

/**
 * Plan modifié : retire ce qui est déjà dans l'application (objectif,
 * habitudes et tâches venus de ce plan), même si Get iT AI le propose encore.
 */
export function withoutAdded(
  plan: DevelopmentPlan,
  added: { goals: string[]; habits: string[]; tasks: string[] },
): DevelopmentPlan {
  const known = (titles: string[]) => {
    const keys = new Set(titles.map(titleKey));
    return (title: string) => keys.has(titleKey(title));
  };
  const goal = known(added.goals);
  const habit = known(added.habits);
  const task = known(added.tasks);
  return {
    ...plan,
    goal: plan.goal && !goal(plan.goal.title) ? plan.goal : null,
    habits: plan.habits.filter((item) => !habit(item.title)),
    tasks: plan.tasks.filter((item) => !task(item.title)),
  };
}

/** Moment enregistré : absent des plans créés avant les moments. */
const storedMoment = z
  .enum(DAY_MOMENTS)
  .nullable()
  .optional()
  .transform((moment) => moment ?? null);

/** Heure enregistrée : absente des plans créés avant les heures. */
const storedTime = minuteOfDaySchema
  .nullable()
  .optional()
  .transform((time) => time ?? null);

/** Plan relu depuis la base (déjà normalisé à l'enregistrement). */
export const storedPlanSchema: z.ZodType<DevelopmentPlan> = z.object({
  title: z.string(),
  summary: z.string(),
  highlights: z.array(z.object({ label: z.string(), value: z.string() })),
  schedule: z.array(
    z.object({
      weekday: z.number().int(),
      moment: storedMoment,
      time: storedTime,
      title: z.string(),
      items: z.array(z.object({ name: z.string(), detail: z.string() })),
    }),
  ),
  sections: z.array(z.object({ title: z.string(), items: z.array(item) })),
  goal: z
    .object({ title: z.string(), targetInDays: z.number().int() })
    .nullable(),
  habits: z.array(
    z.object({
      title: z.string(),
      weekdays: z.array(z.number().int()),
      moment: storedMoment,
    }),
  ),
  tasks: z.array(z.object({ title: z.string(), dueInDays: z.number().int() })),
  caution: z.string(),
});

/** Ce que l'utilisateur garde du plan : revalidé côté serveur avant création. */
export const developmentSelectionSchema = z.object({
  goal: z.boolean(),
  habits: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(HABIT_TITLE_MAX_LENGTH),
        weekdays: z
          .array(z.number().int().min(1).max(7))
          .min(1)
          .max(7)
          .refine((days) => new Set(days).size === days.length),
      }),
    )
    .max(DEVELOPMENT_PLAN_LIMITS.habits),
  tasks: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(ITEM_TITLE_MAX_LENGTH),
        dueInDays: z
          .number()
          .int()
          .min(0)
          .max(DEVELOPMENT_PLAN_LIMITS.taskHorizonDays),
      }),
    )
    .max(DEVELOPMENT_PLAN_LIMITS.tasks),
});

export type DevelopmentSelection = z.infer<typeof developmentSelectionSchema>;
