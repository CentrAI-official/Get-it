import "server-only";
import { io } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import {
  activitySummary,
  COHORT_WEEKS,
  countActive,
  funnel,
  northStarShare,
  rankUsage,
  weekStart,
  weeklyCohorts,
  type ActivityDay,
  type Cohort,
  type DayKey,
  type FunnelStep,
} from "@/features/analytics/metrics";
import {
  ANALYTICS_FEATURES,
  type AnalyticsFeature,
  type DashboardPeriod,
} from "@/features/analytics/rules";
import {
  ANALYTICS_CATEGORIES,
  type AnalyticsCategory,
} from "@/features/analytics/sections";
import { addDays, daysBetween } from "@/lib/dates";
import { db } from "@/server/db";
import { requireAdmin } from "./auth";
import {
  dayOf,
  env,
  firstDayOf,
  inPeriod,
  PEOPLE,
  sinceDays,
  todayKey,
  toNumber,
} from "./sql";

// Lectures du dashboard de l'équipe. Chaque fonction revérifie l'accès (règles
// communes dans sql.ts). Une personne est « active » un jour où elle a ouvert
// l'application ou agi (publication, message, habitude, Get iT AI…) : les tables
// existantes donnent l'historique.

/**
 * Actions de chaque fonction depuis `since`, une ligne par action (clé, personne,
 * moment). Sert au classement des fonctions et à l'activité : une personne qui
 * se sert d'une fonction est toujours comptée active ce jour-là.
 */
const featureActions = (since: Date) => Prisma.sql`
        SELECT 'posts' AS key, user_id, created_at AS at FROM posts
          WHERE created_at >= ${since} AND shared_post_id IS NULL
        UNION ALL SELECT 'shares', user_id, created_at FROM posts
          WHERE created_at >= ${since} AND shared_post_id IS NOT NULL
        UNION ALL SELECT 'comments', user_id, created_at FROM post_comments WHERE created_at >= ${since}
        UNION ALL SELECT 'likes', user_id, created_at FROM post_reactions WHERE created_at >= ${since}
        UNION ALL SELECT 'saves', user_id, created_at FROM post_saves WHERE created_at >= ${since}
        UNION ALL SELECT 'stories', user_id, created_at FROM stories WHERE created_at >= ${since}
        UNION ALL SELECT 'storyViews', viewer_id, viewed_at FROM story_views WHERE viewed_at >= ${since}
        UNION ALL SELECT 'messages', sender_id, created_at FROM messages WHERE created_at >= ${since}
        UNION ALL SELECT 'contacts', requester_id, created_at FROM contacts WHERE created_at >= ${since}
        UNION ALL SELECT 'follows', follower_id, created_at FROM follows WHERE created_at >= ${since}
        UNION ALL SELECT 'groups', user_id, joined_at FROM group_members WHERE joined_at >= ${since}
        UNION ALL SELECT 'pacts', user_id, joined_at FROM pact_members WHERE joined_at >= ${since}
        UNION ALL SELECT 'goals', user_id, created_at FROM goals WHERE created_at >= ${since}
        UNION ALL SELECT 'tasks', user_id, completed_at FROM tasks WHERE completed_at >= ${since}
        UNION ALL SELECT 'habits', h.user_id, c.created_at FROM habit_completions c
          JOIN habits h ON h.id = c.habit_id WHERE c.created_at >= ${since}
        UNION ALL SELECT 'journal', user_id, created_at FROM journal_entries WHERE created_at >= ${since}
        UNION ALL SELECT 'checkIns', user_id, created_at FROM daily_check_ins WHERE created_at >= ${since}
        UNION ALL SELECT 'calendarEvents', user_id, created_at FROM calendar_events WHERE created_at >= ${since}
        UNION ALL SELECT 'budget', user_id, created_at FROM budget_entries WHERE created_at >= ${since}
        UNION ALL SELECT 'budget', user_id, created_at FROM budget_recurring WHERE created_at >= ${since}
        UNION ALL SELECT
          CASE kind
            WHEN 'coach' THEN 'coach'
            WHEN 'goal_plan' THEN 'goalPlans'
            WHEN 'item_edit' THEN 'itemEdits'
            ELSE 'developmentPlans'
          END, user_id, created_at
          FROM ai_requests
          WHERE created_at >= ${since}
            AND kind IN ('coach', 'goal_plan', 'item_edit', 'development_plan', 'development_revision')
        UNION ALL SELECT 'ranked', user_id, measured_at FROM measurements WHERE measured_at >= ${since}
        UNION ALL SELECT 'favorites', user_id, created_at FROM listing_favorites WHERE created_at >= ${since}
        UNION ALL SELECT 'listings', seller_id, created_at FROM listings WHERE created_at >= ${since}`;

/**
 * Actions de progrès depuis `since` (celles qui font avancer la série du jour) :
 * habitude cochée, tâche, jalon ou objectif terminé, check-in, page de journal.
 */
const progressActions = (since: Date) => Prisma.sql`
        SELECT h.user_id, c.created_at AS at FROM habit_completions c
          JOIN habits h ON h.id = c.habit_id WHERE c.created_at >= ${since}
        UNION ALL SELECT user_id, completed_at FROM tasks WHERE completed_at >= ${since}
        UNION ALL SELECT g.user_id, m.completed_at FROM goal_milestones m
          JOIN goals g ON g.id = m.goal_id WHERE m.completed_at >= ${since}
        UNION ALL SELECT user_id, completed_at FROM goals WHERE completed_at >= ${since}
        UNION ALL SELECT user_id, created_at FROM daily_check_ins WHERE created_at >= ${since}
        UNION ALL SELECT user_id, created_at FROM journal_entries WHERE created_at >= ${since}`;

/** Jours d'activité de chaque personne depuis `since`. */
async function activityDays(since: Date): Promise<ActivityDay[]> {
  return db.$queryRaw<ActivityDay[]>`
    WITH people AS (${PEOPLE}),
    activity AS (
      SELECT user_id, occurred_at AS at FROM analytics_events
        WHERE env = ${env()} AND occurred_at >= ${since}
      UNION ALL SELECT user_id, at FROM (${progressActions(since)}) progress
      UNION ALL SELECT user_id, at FROM (${featureActions(since)}) actions
    )
    SELECT DISTINCT a.user_id::text AS "userId", ${dayOf(Prisma.sql`a.at`)} AS day
    FROM activity a JOIN people p ON p.id = a.user_id`;
}

/** Jours où chaque personne a fait une action de progrès (habitude, tâche, jalon, journal…). */
async function progressDays(since: Date): Promise<ActivityDay[]> {
  return db.$queryRaw<ActivityDay[]>`
    WITH people AS (${PEOPLE})
    SELECT DISTINCT a.user_id::text AS "userId", ${dayOf(Prisma.sql`a.at`)} AS day
    FROM (${progressActions(since)}) a JOIN people p ON p.id = a.user_id`;
}

/** Chiffre de la période et le même chiffre sur la période précédente (même durée). */
export type Compared = { value: number | null; previous: number | null };

export type Overview = {
  today: DayKey;
  period: DashboardPeriod;
  /** Tous les comptes comptés (sans l'équipe ni les comptes de test). */
  members: number;
  /** Dont ceux qui ont terminé l'onboarding. */
  onboarded: number;
  /** Inscrits sur la période. */
  newMembers: Compared;
  /** Personnes actives au moins un jour de la période. */
  active: Compared;
  dau: number;
  wau: number;
  mau: number;
  stickiness: number | null;
  /** Cette semaine et la semaine d'avant (toujours 7 jours). */
  northStar: Compared;
  /** Minutes actives moyennes par personne et par jour d'utilisation. */
  minutesPerDay: Compared;
  personalized: number;
  aiConsent: number;
  series: { day: DayKey; active: number; signups: number; minutes: number }[];
};

export async function getOverview(period: DashboardPeriod): Promise<Overview> {
  await requireAdmin();
  await io();
  const now = new Date();
  const today = todayKey(now);
  // La période et la précédente, et au moins 30 jours (actifs du mois)
  const since = sinceDays(now, Math.max(2 * period, 30));
  const firstDay = firstDayOf(today, period);
  const previousFirst = addDays(firstDay, -period);
  const previousLast = addDays(firstDay, -1);

  const [activity, progress, totals, signups, time] = await Promise.all([
    activityDays(since),
    progressDays(sinceDays(now, 14)),
    db.$queryRaw<
      {
        members: bigint;
        onboarded: bigint;
        personalized: bigint;
        aiConsent: bigint;
      }[]
    >`
      SELECT count(*) AS members,
        count(*) FILTER (WHERE p.onboarded_at IS NOT NULL) AS onboarded,
        count(*) FILTER (WHERE s.personalization_consent_at IS NOT NULL) AS personalized,
        count(*) FILTER (WHERE s.ai_consent_at IS NOT NULL) AS "aiConsent"
      FROM profiles p LEFT JOIN user_settings s ON s.user_id = p.id
      WHERE p.role <> 'admin' AND NOT p.analytics_excluded`,
    db.$queryRaw<{ day: DayKey; count: number }[]>`
      SELECT ${dayOf(Prisma.sql`created_at`)} AS day, count(*)::int AS count
      FROM profiles
      WHERE role <> 'admin' AND NOT analytics_excluded AND created_at >= ${since}
      GROUP BY 1`,
    db.$queryRaw<{ day: DayKey; ms: bigint; users: number }[]>`
      WITH people AS (${PEOPLE})
      SELECT ${dayOf(Prisma.sql`e.occurred_at`)} AS day,
        sum(e.duration_ms)::bigint AS ms, count(DISTINCT e.user_id)::int AS users
      FROM analytics_events e JOIN people p ON p.id = e.user_id
      WHERE e.env = ${env()} AND e.name = 'time' AND e.occurred_at >= ${since}
      GROUP BY 1`,
  ]);

  const summary = activitySummary(activity, today, period);
  const signupsOn = new Map(signups.map((row) => [row.day, row.count]));
  const timeOn = new Map(time.map((row) => [row.day, row]));
  const between = (from: DayKey, to: DayKey) => ({
    signups: signups
      .filter((row) => row.day >= from && row.day <= to)
      .reduce((sum, row) => sum + row.count, 0),
    minutes: minutesPerActiveDay(
      time.filter((row) => row.day >= from && row.day <= to),
    ),
  });
  const current = between(firstDay, today);
  const previous = between(previousFirst, previousLast);
  const row = totals[0];

  return {
    today,
    period,
    members: toNumber(row?.members ?? 0),
    onboarded: toNumber(row?.onboarded ?? 0),
    newMembers: { value: current.signups, previous: previous.signups },
    active: {
      value: summary.activeInPeriod,
      previous: countActive(activity, previousFirst, previousLast),
    },
    dau: summary.dau,
    wau: summary.wau,
    mau: summary.mau,
    stickiness: summary.stickiness,
    northStar: {
      value: northStarShare(activity, progress, today),
      previous: northStarShare(activity, progress, addDays(today, -7)),
    },
    minutesPerDay: { value: current.minutes, previous: previous.minutes },
    personalized: toNumber(row?.personalized ?? 0),
    aiConsent: toNumber(row?.aiConsent ?? 0),
    series: summary.series.map(({ day, active }) => ({
      day,
      active,
      signups: signupsOn.get(day) ?? 0,
      minutes: Math.round(toNumber(timeOn.get(day)?.ms ?? 0) / 60_000),
    })),
  };
}

/** Minutes actives moyennes par personne et par jour où elle est venue. */
function minutesPerActiveDay(rows: readonly { ms: bigint; users: number }[]) {
  const userDays = rows.reduce((sum, row) => sum + row.users, 0);
  if (userDays === 0) return null;
  const totalMs = rows.reduce((sum, row) => sum + toNumber(row.ms), 0);
  return totalMs / userDays / 60_000;
}

export type SectionUsage = {
  key: string;
  category: AnalyticsCategory;
  users: number;
  /** Minutes actives au total. */
  minutes: number;
  /** Minutes moyennes par personne qui y est allée. */
  minutesPerUser: number;
  share: number | null;
  reach: number | null;
};

export type SectionsReport = {
  /** Personnes qui ont utilisé l'application pendant la période (temps mesuré). */
  users: number;
  categories: SectionUsage[];
  sections: SectionUsage[];
  opens: { key: string; opens: number; users: number }[];
};

export async function getSections(
  period: DashboardPeriod,
): Promise<SectionsReport> {
  await requireAdmin();
  await io();
  const now = new Date();
  const since = sinceDays(now, period);
  const firstDay = firstDayOf(todayKey(now), period);
  const base = Prisma.sql`
    FROM analytics_events e JOIN people p ON p.id = e.user_id
    WHERE e.env = ${env()} AND e.occurred_at >= ${since}
      AND ${inPeriod(Prisma.sql`e.occurred_at`, firstDay)}`;

  const [totals, categories, sections, opens] = await Promise.all([
    db.$queryRaw<{ users: number }[]>`
      WITH people AS (${PEOPLE})
      SELECT count(DISTINCT e.user_id)::int AS users ${base} AND e.name = 'time'`,
    db.$queryRaw<{ key: string; users: number; ms: bigint }[]>`
      WITH people AS (${PEOPLE})
      SELECT split_part(e.section, '.', 1) AS key,
        count(DISTINCT e.user_id)::int AS users, sum(e.duration_ms)::bigint AS ms
      ${base} AND e.name = 'time' GROUP BY 1`,
    db.$queryRaw<{ key: string; users: number; ms: bigint }[]>`
      WITH people AS (${PEOPLE})
      SELECT e.section AS key,
        count(DISTINCT e.user_id)::int AS users, sum(e.duration_ms)::bigint AS ms
      ${base} AND e.name = 'time' GROUP BY 1`,
    db.$queryRaw<{ key: string; opens: number; users: number }[]>`
      WITH people AS (${PEOPLE})
      SELECT e.section AS key, count(*)::int AS opens,
        count(DISTINCT e.user_id)::int AS users
      ${base} AND e.name = 'open' GROUP BY 1 ORDER BY 2 DESC`,
  ]);
  const users = totals[0]?.users ?? 0;

  const usage = (
    rows: readonly { key: string; users: number; ms: bigint }[],
    categoryOfRow: (key: string) => AnalyticsCategory,
  ): SectionUsage[] =>
    rankUsage(
      rows.map((row) => ({
        key: row.key,
        users: row.users,
        total: toNumber(row.ms),
      })),
      users,
    )
      // Le plus de temps d'abord : « ce qui est le plus utilisé »
      .sort((a, b) => b.total - a.total)
      .map((row) => ({
        key: row.key,
        category: categoryOfRow(row.key),
        users: row.users,
        minutes: row.total / 60_000,
        minutesPerUser: row.users === 0 ? 0 : row.total / row.users / 60_000,
        share: row.share,
        reach: row.reach,
      }));
  const asCategory = (key: string): AnalyticsCategory =>
    ANALYTICS_CATEGORIES.find((category) => category === key) ?? "other";

  return {
    users,
    categories: usage(categories, asCategory),
    sections: usage(sections, (key) => asCategory(key.split(".")[0] ?? "")),
    opens,
  };
}

export type FeatureUsage = {
  key: AnalyticsFeature;
  users: number;
  actions: number;
  reach: number | null;
};

export type FeaturesReport = {
  /** Personnes actives pendant la période (dénominateur de la portée). */
  activeUsers: number;
  features: FeatureUsage[];
};

export async function getFeatures(
  period: DashboardPeriod,
): Promise<FeaturesReport> {
  await requireAdmin();
  await io();
  const now = new Date();
  const since = sinceDays(now, period);
  const firstDay = firstDayOf(todayKey(now), period);

  const [rows, activity] = await Promise.all([
    db.$queryRaw<{ key: AnalyticsFeature; users: number; actions: number }[]>`
      WITH people AS (${PEOPLE}),
      actions AS (${featureActions(since)})
      SELECT a.key, count(DISTINCT a.user_id)::int AS users, count(*)::int AS actions
      FROM actions a JOIN people p ON p.id = a.user_id
      WHERE ${inPeriod(Prisma.sql`a.at`, firstDay)}
      GROUP BY a.key`,
    activityDays(since),
  ]);

  const activeUsers = activitySummary(
    activity,
    todayKey(now),
    period,
  ).activeInPeriod;
  const byKey = new Map(rows.map((row) => [row.key, row]));
  // Les fonctions jamais utilisées apparaissent aussi, en bas du classement
  const ranked = rankUsage(
    ANALYTICS_FEATURES.map((key) => ({
      key,
      users: byKey.get(key)?.users ?? 0,
      total: byKey.get(key)?.actions ?? 0,
    })),
    activeUsers,
  );
  return {
    activeUsers,
    features: ranked.map((row) => ({
      key: row.key,
      users: row.users,
      actions: row.total,
      reach: row.reach,
    })),
  };
}

export type RetentionReport = {
  cohorts: Cohort[];
  /** Parcours des personnes inscrites pendant la période, depuis au moins 7 jours. */
  funnel: { step: FunnelStep; count: number }[];
};

export async function getRetention(
  period: DashboardPeriod,
): Promise<RetentionReport> {
  await requireAdmin();
  await io();
  const now = new Date();
  const today = todayKey(now);
  // Huit semaines de cohortes, plus les cinq semaines qui suivent leur inscription
  const firstWeek = addDays(weekStart(today), -7 * (COHORT_WEEKS - 1));
  const lookback = Math.max(daysBetween(firstWeek, today), period) + 1;
  const since = sinceDays(now, lookback);

  const [members, activity] = await Promise.all([
    db.$queryRaw<
      {
        userId: string;
        signupDay: DayKey;
        onboarded: boolean;
        firstGoal: boolean;
        firstHabit: boolean;
      }[]
    >`
      SELECT p.id::text AS "userId", ${dayOf(Prisma.sql`p.created_at`)} AS "signupDay",
        p.onboarded_at IS NOT NULL AS onboarded,
        EXISTS (SELECT 1 FROM goals g WHERE g.user_id = p.id) AS "firstGoal",
        EXISTS (
          SELECT 1 FROM habit_completions c JOIN habits h ON h.id = c.habit_id
          WHERE h.user_id = p.id
        ) AS "firstHabit"
      FROM profiles p
      WHERE p.role <> 'admin' AND NOT p.analytics_excluded AND p.created_at >= ${since}`,
    activityDays(since),
  ]);

  const activeDays = new Map<string, DayKey[]>();
  for (const { userId, day } of activity) {
    activeDays.set(userId, [...(activeDays.get(userId) ?? []), day]);
  }
  const periodStart = firstDayOf(today, period);
  const eligible = members.filter(
    (member) =>
      member.signupDay >= periodStart &&
      daysBetween(member.signupDay, today) >= 7,
  );

  return {
    cohorts: weeklyCohorts(members, activity, today),
    funnel: funnel(
      eligible.map((member) => ({
        onboarded: member.onboarded,
        firstGoal: member.firstGoal,
        firstHabit: member.firstHabit,
        returned: (activeDays.get(member.userId) ?? []).some(
          (day) => daysBetween(member.signupDay, day) >= 7,
        ),
      })),
    ),
  };
}

export type AiUsage = {
  requests: number;
  users: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  byKind: { kind: string; requests: number; users: number }[];
  series: { day: DayKey; requests: number }[];
  /** Propositions de Get iT AI : ajoutées, écartées, en attente. */
  proposals: { applied: number; dismissed: number; pending: number };
};

export async function getAiUsage(period: DashboardPeriod): Promise<AiUsage> {
  await requireAdmin();
  await io();
  const now = new Date();
  const since = sinceDays(now, period);
  const firstDay = firstDayOf(todayKey(now), period);
  const base = Prisma.sql`
    FROM ai_requests a JOIN people p ON p.id = a.user_id
    WHERE a.created_at >= ${since} AND ${inPeriod(Prisma.sql`a.created_at`, firstDay)}`;

  const [totals, kinds, days, actions] = await Promise.all([
    db.$queryRaw<
      {
        requests: number;
        users: number;
        input: bigint | null;
        output: bigint | null;
        cacheRead: bigint | null;
        cacheWrite: bigint | null;
      }[]
    >`
      WITH people AS (${PEOPLE})
      SELECT count(*)::int AS requests, count(DISTINCT a.user_id)::int AS users,
        sum(a.input_tokens)::bigint AS input, sum(a.output_tokens)::bigint AS output,
        sum(a.cache_read_tokens)::bigint AS "cacheRead",
        sum(a.cache_write_tokens)::bigint AS "cacheWrite"
      ${base}`,
    db.$queryRaw<{ kind: string; requests: number; users: number }[]>`
      WITH people AS (${PEOPLE})
      SELECT a.kind::text AS kind, count(*)::int AS requests,
        count(DISTINCT a.user_id)::int AS users
      ${base} GROUP BY 1 ORDER BY 2 DESC`,
    db.$queryRaw<{ day: DayKey; requests: number }[]>`
      WITH people AS (${PEOPLE})
      SELECT ${dayOf(Prisma.sql`a.created_at`)} AS day, count(*)::int AS requests
      ${base} GROUP BY 1`,
    db.$queryRaw<{ status: string; count: number }[]>`
      WITH people AS (${PEOPLE})
      SELECT c.status::text AS status, count(*)::int AS count
      FROM coach_actions c JOIN people p ON p.id = c.user_id
      WHERE c.created_at >= ${since} AND ${inPeriod(Prisma.sql`c.created_at`, firstDay)}
      GROUP BY 1`,
  ]);
  const total = totals[0];
  const perDay = new Map(days.map((row) => [row.day, row.requests]));
  const status = new Map(actions.map((row) => [row.status, row.count]));

  return {
    requests: total?.requests ?? 0,
    users: total?.users ?? 0,
    inputTokens: toNumber(total?.input ?? 0),
    outputTokens: toNumber(total?.output ?? 0),
    cacheReadTokens: toNumber(total?.cacheRead ?? 0),
    cacheWriteTokens: toNumber(total?.cacheWrite ?? 0),
    byKind: kinds,
    series: Array.from({ length: period }, (_, index) => {
      const day = addDays(firstDay, index);
      return { day, requests: perDay.get(day) ?? 0 };
    }),
    proposals: {
      applied: status.get("applied") ?? 0,
      dismissed: status.get("dismissed") ?? 0,
      pending: status.get("pending") ?? 0,
    },
  };
}
