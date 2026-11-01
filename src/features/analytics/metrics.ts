import { addDays, daysBetween, isoWeekday, lastDays } from "@/lib/dates";

// Calculs du dashboard (fonctions pures, testées dans analytics.test.ts). Les
// jours sont des clés « AAAA-MM-JJ » dans le fuseau du dashboard.

export type DayKey = string;
export type ActivityDay = { userId: string; day: DayKey };

/** Lundi de la semaine du jour. */
export function weekStart(day: DayKey): DayKey {
  return addDays(day, 1 - isoWeekday(day));
}

/** Personnes distinctes actives entre deux jours inclus. */
function activeBetween(days: readonly ActivityDay[], from: DayKey, to: DayKey) {
  const users = new Set<string>();
  for (const { userId, day } of days) {
    if (day >= from && day <= to) users.add(userId);
  }
  return users;
}

/** Personnes actives au moins un jour entre deux jours inclus. */
export function countActive(
  days: readonly ActivityDay[],
  from: DayKey,
  to: DayKey,
) {
  return activeBetween(days, from, to).size;
}

/**
 * Évolution par rapport à la période précédente (0,12 = +12 %) ; null sans
 * point de comparaison (rien la période d'avant).
 */
export function relativeChange(
  current: number | null,
  previous: number | null,
): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return (current - previous) / previous;
}

export type ActivitySummary = {
  /** Actifs de chaque jour de la période. */
  series: { day: DayKey; active: number }[];
  dau: number;
  wau: number;
  mau: number;
  /** Actifs moyens par jour sur 30 jours, divisés par les actifs du mois (0 à 1). */
  stickiness: number | null;
  /** Personnes actives au moins un jour de la période. */
  activeInPeriod: number;
};

/** Membres actifs par jour, semaine et mois, à partir de leurs jours d'activité. */
export function activitySummary(
  days: readonly ActivityDay[],
  today: DayKey,
  period: number,
): ActivitySummary {
  const perDay = new Map<DayKey, Set<string>>();
  for (const { userId, day } of days) {
    const users = perDay.get(day) ?? new Set<string>();
    users.add(userId);
    perDay.set(day, users);
  }
  const countOn = (day: DayKey) => perDay.get(day)?.size ?? 0;

  const month = lastDays(today, 30);
  const mau = activeBetween(days, month[0] ?? today, today).size;
  const averageDau =
    month.reduce((sum, day) => sum + countOn(day), 0) / month.length;

  const periodDays = lastDays(today, period);
  return {
    series: periodDays.map((day) => ({ day, active: countOn(day) })),
    dau: countOn(today),
    wau: activeBetween(days, addDays(today, -6), today).size,
    mau,
    stickiness: mau === 0 ? null : averageDau / mau,
    activeInPeriod: activeBetween(days, periodDays[0] ?? today, today).size,
  };
}

/** Jours d'action de progrès par semaine pour compter dans la métrique étoile. */
export const NORTH_STAR_DAYS = 3;

/**
 * Métrique étoile : la part des membres actifs des 7 derniers jours qui ont fait
 * une action de progrès (habitude, tâche, journal, jalon…) au moins 3 jours.
 */
export function northStarShare(
  activity: readonly ActivityDay[],
  progress: readonly ActivityDay[],
  today: DayKey,
): number | null {
  const from = addDays(today, -6);
  const active = activeBetween(activity, from, today);
  if (active.size === 0) return null;
  const progressDays = new Map<string, Set<DayKey>>();
  for (const { userId, day } of progress) {
    if (day < from || day > today || !active.has(userId)) continue;
    const userDays = progressDays.get(userId) ?? new Set<DayKey>();
    userDays.add(day);
    progressDays.set(userId, userDays);
  }
  const reached = [...progressDays.values()].filter(
    (userDays) => userDays.size >= NORTH_STAR_DAYS,
  ).length;
  return reached / active.size;
}

export type UsageRow<K extends string = string> = {
  key: K;
  /** Personnes distinctes. */
  users: number;
  /** Actions ou millisecondes, selon la mesure. */
  total: number;
};

export type RankedUsage<K extends string = string> = UsageRow<K> & {
  /** Part des membres actifs de la période (0 à 1). */
  reach: number | null;
  /** Part du total de toutes les lignes (0 à 1). */
  share: number | null;
};

/** Classe du plus utilisé au moins utilisé (personnes, puis total). */
export function rankUsage<K extends string>(
  rows: readonly UsageRow<K>[],
  activeUsers: number,
): RankedUsage<K>[] {
  const sum = rows.reduce((total, row) => total + row.total, 0);
  return [...rows]
    .sort((a, b) => b.users - a.users || b.total - a.total)
    .map((row) => ({
      ...row,
      reach: activeUsers === 0 ? null : row.users / activeUsers,
      share: sum === 0 ? null : row.total / sum,
    }));
}

export type Cohort = {
  /** Lundi de la semaine d'inscription. */
  week: DayKey;
  size: number;
  /** Part revenue le lendemain de l'inscription ; null si ce jour n'est pas encore passé. */
  day1: number | null;
  /** Part active pendant la 2e, 3e, 4e et 5e semaine après l'inscription. */
  weeks: (number | null)[];
};

export const COHORT_WEEKS = 8;
export const RETENTION_WEEKS = 4;

/**
 * Rétention par semaine d'inscription : qui revient le lendemain, puis pendant
 * chacune des 4 semaines suivantes (jours 7 à 13, 14 à 20…). Une période pas
 * encore entièrement passée vaut null.
 */
export function weeklyCohorts(
  members: readonly { userId: string; signupDay: DayKey }[],
  activity: readonly ActivityDay[],
  today: DayKey,
): Cohort[] {
  const daysOf = new Map<string, Set<DayKey>>();
  for (const { userId, day } of activity) {
    const userDays = daysOf.get(userId) ?? new Set<DayKey>();
    userDays.add(day);
    daysOf.set(userId, userDays);
  }
  const activeWithin = (
    member: { userId: string; signupDay: DayKey },
    from: number,
    to: number,
  ) => {
    const userDays = daysOf.get(member.userId);
    if (!userDays) return false;
    for (let offset = from; offset <= to; offset++) {
      if (userDays.has(addDays(member.signupDay, offset))) return true;
    }
    return false;
  };
  const share = (
    cohort: readonly { userId: string; signupDay: DayKey }[],
    from: number,
    to: number,
  ) => {
    // Seules les personnes dont la période est entièrement passée comptent
    const eligible = cohort.filter(
      (member) => daysBetween(member.signupDay, today) >= to,
    );
    if (eligible.length === 0) return null;
    return (
      eligible.filter((member) => activeWithin(member, from, to)).length /
      eligible.length
    );
  };

  const firstWeek = addDays(weekStart(today), -7 * (COHORT_WEEKS - 1));
  return Array.from({ length: COHORT_WEEKS }, (_, index) => {
    const week = addDays(firstWeek, index * 7);
    const cohort = members.filter(
      (member) => weekStart(member.signupDay) === week,
    );
    return {
      week,
      size: cohort.length,
      day1: share(cohort, 1, 1),
      weeks: Array.from({ length: RETENTION_WEEKS }, (_, w) =>
        share(cohort, 7 * (w + 1), 7 * (w + 1) + 6),
      ),
    };
  }).reverse();
}

export const FUNNEL_STEPS = [
  "signedUp",
  "onboarded",
  "firstGoal",
  "firstHabit",
  "returned",
] as const;
export type FunnelStep = (typeof FUNNEL_STEPS)[number];

/**
 * Parcours des personnes inscrites : chaque étape compte celles qui l'ont
 * franchie (sans exiger les précédentes, pour voir où l'on décroche).
 */
export function funnel(
  rows: readonly Record<Exclude<FunnelStep, "signedUp">, boolean>[],
): { step: FunnelStep; count: number }[] {
  return FUNNEL_STEPS.map((step) => ({
    step,
    count:
      step === "signedUp"
        ? rows.length
        : rows.filter((row) => row[step]).length,
  }));
}
