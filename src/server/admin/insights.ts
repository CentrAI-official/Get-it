import "server-only";
import { io } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import type { DayKey } from "@/features/analytics/metrics";
import type { DashboardPeriod } from "@/features/analytics/rules";
import { addDays } from "@/lib/dates";
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
} from "./sql";

// Lectures du dashboard au-delà de l'usage : résultats (est-ce que Get iT aide
// vraiment ?), contenu populaire, avis des membres et erreurs. Chaque fonction
// revérifie l'accès.

/** Bornes d'une période : `since` pour l'index, `firstDay` pour être exact au jour près. */
async function periodBounds(period: DashboardPeriod) {
  await requireAdmin();
  await io();
  const now = new Date();
  const today = todayKey(now);
  return {
    now,
    today,
    since: sinceDays(now, period),
    firstDay: firstDayOf(today, period),
  };
}

const ratio = (part: number, whole: number) =>
  whole === 0 ? null : part / whole;

export type Outcomes = {
  goals: {
    created: number;
    completed: number;
    archived: number;
    active: number;
    /** Atteints sur (atteints + mis de côté) pendant la période. */
    successRate: number | null;
    /** Jours médians entre la création et la réussite. */
    medianDays: number | null;
  };
  habits: {
    active: number;
    archived: number;
    /** Habitudes d'au moins 30 jours, encore cochées ces 7 derniers jours. */
    kept: number;
    eligible: number;
    keptRate: number | null;
    checks: number;
  };
  tasks: {
    created: number;
    /** Créées pendant la période et déjà faites. */
    doneOfCreated: number;
    doneRate: number | null;
    overdue: number;
  };
  pacts: {
    ended: number;
    succeeded: number;
    successRate: number | null;
    active: number;
  };
};

export async function getOutcomes(period: DashboardPeriod): Promise<Outcomes> {
  const { now, today, since, firstDay } = await periodBounds(period);
  const month = new Date(now.getTime() - 30 * 86_400_000);
  const week = new Date(now.getTime() - 7 * 86_400_000);

  const [goals, habits, tasks, pacts] = await Promise.all([
    db.$queryRaw<
      {
        created: number;
        completed: number;
        archived: number;
        active: number;
        medianDays: number | null;
      }[]
    >`
      WITH people AS (${PEOPLE})
      SELECT
        count(*) FILTER (WHERE g.created_at >= ${since} AND ${inPeriod(Prisma.sql`g.created_at`, firstDay)})::int AS created,
        count(*) FILTER (WHERE g.status = 'completed' AND g.completed_at >= ${since} AND ${inPeriod(Prisma.sql`g.completed_at`, firstDay)})::int AS completed,
        count(*) FILTER (WHERE g.status = 'archived' AND g.updated_at >= ${since} AND ${inPeriod(Prisma.sql`g.updated_at`, firstDay)})::int AS archived,
        count(*) FILTER (WHERE g.status = 'active')::int AS active,
        percentile_cont(0.5) WITHIN GROUP (
          ORDER BY extract(epoch FROM g.completed_at - g.created_at) / 86400
        ) FILTER (
          WHERE g.status = 'completed' AND g.completed_at >= ${since} AND ${inPeriod(Prisma.sql`g.completed_at`, firstDay)}
        ) AS "medianDays"
      FROM goals g JOIN people p ON p.id = g.user_id`,
    db.$queryRaw<
      {
        active: number;
        archived: number;
        eligible: number;
        kept: number;
        checks: number;
      }[]
    >`
      WITH people AS (${PEOPLE}),
      old AS (
        SELECT h.id FROM habits h JOIN people p ON p.id = h.user_id
        WHERE h.created_at <= ${month}
          AND (h.archived_at IS NULL OR h.archived_at >= h.created_at + interval '30 days')
      )
      SELECT
        (SELECT count(*)::int FROM habits h JOIN people p ON p.id = h.user_id
          WHERE h.archived_at IS NULL) AS active,
        (SELECT count(*)::int FROM habits h JOIN people p ON p.id = h.user_id
          WHERE h.archived_at >= ${since} AND ${inPeriod(Prisma.sql`h.archived_at`, firstDay)}) AS archived,
        (SELECT count(*)::int FROM old) AS eligible,
        (SELECT count(*)::int FROM old WHERE EXISTS (
          SELECT 1 FROM habit_completions c WHERE c.habit_id = old.id AND c.created_at >= ${week}
        )) AS kept,
        (SELECT count(*)::int FROM habit_completions c
          JOIN habits h ON h.id = c.habit_id JOIN people p ON p.id = h.user_id
          WHERE c.created_at >= ${since} AND ${inPeriod(Prisma.sql`c.created_at`, firstDay)}) AS checks`,
    db.$queryRaw<{ created: number; doneOfCreated: number; overdue: number }[]>`
      WITH people AS (${PEOPLE})
      SELECT
        count(*) FILTER (WHERE t.created_at >= ${since} AND ${inPeriod(Prisma.sql`t.created_at`, firstDay)})::int AS created,
        count(*) FILTER (WHERE t.created_at >= ${since} AND ${inPeriod(Prisma.sql`t.created_at`, firstDay)}
          AND t.completed_at IS NOT NULL)::int AS "doneOfCreated",
        count(*) FILTER (WHERE t.completed_at IS NULL AND t.due_date < ${today}::date)::int AS overdue
      FROM tasks t JOIN people p ON p.id = t.user_id`,
    db.$queryRaw<{ ended: number; succeeded: number; active: number }[]>`
      WITH people AS (${PEOPLE})
      SELECT
        count(*) FILTER (WHERE k.status = 'ended' AND k.ends_on >= ${firstDay}::date)::int AS ended,
        count(*) FILTER (WHERE k.status = 'ended' AND k.ends_on >= ${firstDay}::date
          AND k.outcome = 'success')::int AS succeeded,
        count(*) FILTER (WHERE k.status = 'active')::int AS active
      FROM pacts k JOIN people p ON p.id = k.proposed_by_id`,
  ]);

  const g = goals[0] ?? {
    created: 0,
    completed: 0,
    archived: 0,
    active: 0,
    medianDays: null,
  };
  const h = habits[0] ?? {
    active: 0,
    archived: 0,
    eligible: 0,
    kept: 0,
    checks: 0,
  };
  const t = tasks[0] ?? { created: 0, doneOfCreated: 0, overdue: 0 };
  const k = pacts[0] ?? { ended: 0, succeeded: 0, active: 0 };
  return {
    goals: {
      ...g,
      successRate: ratio(g.completed, g.completed + g.archived),
      medianDays: g.medianDays === null ? null : Number(g.medianDays),
    },
    habits: { ...h, keptRate: ratio(h.kept, h.eligible) },
    tasks: { ...t, doneRate: ratio(t.doneOfCreated, t.created) },
    pacts: { ...k, successRate: ratio(k.succeeded, k.ended) },
  };
}

/** Format d'une publication, pour voir ce qui fait réagir. */
export const POST_FORMATS = [
  "progress",
  "question",
  "video",
  "photo",
  "text",
] as const;
export type PostFormat = (typeof POST_FORMATS)[number];

export type ContentPost = {
  id: string;
  author: string;
  excerpt: string;
  format: PostFormat;
  group: string | null;
  createdAt: Date;
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  views: number;
  /** J'aime + 2 × commentaires + 2 × enregistrements + 3 × partages. */
  score: number;
};

export type ContentReport = {
  posts: number;
  top: ContentPost[];
  formats: { format: PostFormat; posts: number; perPost: number }[];
  authors: { author: string; posts: number; score: number }[];
};

export async function getContent(
  period: DashboardPeriod,
): Promise<ContentReport> {
  const { since, firstDay } = await periodBounds(period);
  const rows = await db.$queryRaw<
    {
      id: string;
      kind: string;
      body: string;
      mediaCount: number;
      hasVideo: boolean;
      createdAt: Date;
      username: string | null;
      displayName: string | null;
      groupName: string | null;
      likes: number;
      comments: number;
      saves: number;
      shares: number;
      views: number;
    }[]
  >`
    WITH people AS (${PEOPLE})
    SELECT p.id::text AS id, p.kind::text AS kind, p.body, p.media_count AS "mediaCount",
      EXISTS (SELECT 1 FROM post_media m WHERE m.post_id = p.id AND m.kind = 'video') AS "hasVideo",
      p.created_at AS "createdAt", pr.username, pr.display_name AS "displayName",
      g.name AS "groupName",
      (SELECT count(*)::int FROM post_reactions r WHERE r.post_id = p.id)
        + (SELECT count(*)::int FROM post_page_reactions r WHERE r.post_id = p.id) AS likes,
      (SELECT count(*)::int FROM post_comments c WHERE c.post_id = p.id AND c.status = 'visible') AS comments,
      (SELECT count(*)::int FROM post_saves s WHERE s.post_id = p.id) AS saves,
      (SELECT count(*)::int FROM posts sp WHERE sp.shared_post_id = p.id) AS shares,
      (SELECT count(*)::int FROM post_video_views v WHERE v.post_id = p.id) AS views
    FROM posts p
    JOIN people pe ON pe.id = p.user_id
    JOIN profiles pr ON pr.id = p.user_id
    LEFT JOIN groups g ON g.id = p.group_id
    WHERE p.created_at >= ${since} AND ${inPeriod(Prisma.sql`p.created_at`, firstDay)}
      AND p.status = 'visible' AND p.shared_post_id IS NULL`;

  const posts: ContentPost[] = rows.map((row) => {
    const format: PostFormat =
      row.kind === "progress"
        ? "progress"
        : row.kind === "question"
          ? "question"
          : row.hasVideo
            ? "video"
            : row.mediaCount > 0
              ? "photo"
              : "text";
    const body = row.body.replace(/\s+/g, " ").trim();
    return {
      id: row.id,
      author: row.username ? `@${row.username}` : (row.displayName ?? "—"),
      excerpt: body.length > 140 ? `${body.slice(0, 139)}…` : body,
      format,
      group: row.groupName,
      createdAt: row.createdAt,
      likes: row.likes,
      comments: row.comments,
      saves: row.saves,
      shares: row.shares,
      views: row.views,
      score: row.likes + 2 * row.comments + 2 * row.saves + 3 * row.shares,
    };
  });

  const authors = new Map<string, { posts: number; score: number }>();
  for (const post of posts) {
    const author = authors.get(post.author) ?? { posts: 0, score: 0 };
    authors.set(post.author, {
      posts: author.posts + 1,
      score: author.score + post.score,
    });
  }
  return {
    posts: posts.length,
    top: [...posts].sort((a, b) => b.score - a.score).slice(0, 10),
    formats: POST_FORMATS.map((format) => {
      const of = posts.filter((post) => post.format === format);
      const total = of.reduce((sum, post) => sum + post.score, 0);
      return {
        format,
        posts: of.length,
        perPost: of.length === 0 ? 0 : total / of.length,
      };
    }).sort((a, b) => b.perPost - a.perPost),
    authors: [...authors.entries()]
      .map(([author, value]) => ({ author, ...value }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5),
  };
}

export type FeedbackEntry = {
  id: string;
  kind: string;
  topic: string | null;
  body: string | null;
  author: string;
  at: Date;
};

export type FeedbackReport = {
  counts: Record<"idea" | "problem" | "praise" | "week", number>;
  /** Réponses à « Qu'est-ce qui t'aide le plus? », depuis le début. */
  topics: { topic: string; count: number }[];
  weekAnswers: number;
  entries: FeedbackEntry[];
};

export async function getFeedbackReport(
  period: DashboardPeriod,
): Promise<FeedbackReport> {
  const { since, firstDay } = await periodBounds(period);
  // Les avis de l'équipe comptent aussi : ils servent à tester le formulaire
  const [entries, topics] = await Promise.all([
    db.$queryRaw<
      {
        id: string;
        kind: string;
        topic: string | null;
        body: string | null;
        at: Date;
        username: string | null;
        displayName: string | null;
      }[]
    >`
      SELECT f.id::text AS id, f.kind, f.topic, f.body, f.created_at AS at,
        pr.username, pr.display_name AS "displayName"
      FROM feedback f JOIN profiles pr ON pr.id = f.user_id
      WHERE f.created_at >= ${since} AND ${inPeriod(Prisma.sql`f.created_at`, firstDay)}
      ORDER BY f.created_at DESC
      LIMIT 200`,
    db.$queryRaw<{ topic: string; count: number }[]>`
      SELECT topic, count(*)::int AS count FROM feedback
      WHERE kind = 'week' AND topic IS NOT NULL
      GROUP BY topic ORDER BY 2 DESC`,
  ]);
  const counts = { idea: 0, problem: 0, praise: 0, week: 0 };
  for (const entry of entries) {
    if (entry.kind in counts) counts[entry.kind as keyof typeof counts] += 1;
  }
  return {
    counts,
    topics,
    weekAnswers: topics.reduce((sum, row) => sum + row.count, 0),
    entries: entries.map((entry) => ({
      id: entry.id,
      kind: entry.kind,
      topic: entry.topic,
      body: entry.body,
      at: entry.at,
      author: entry.username
        ? `@${entry.username}`
        : (entry.displayName ?? "—"),
    })),
  };
}

export type ErrorGroup = {
  source: string;
  message: string;
  route: string | null;
  count: number;
  people: number;
  lastAt: Date;
};

export type ErrorsReport = {
  total: number;
  people: number;
  routes: number;
  groups: ErrorGroup[];
  series: { day: DayKey; errors: number }[];
};

export async function getErrorsReport(
  period: DashboardPeriod,
): Promise<ErrorsReport> {
  const { since, firstDay } = await periodBounds(period);
  const base = Prisma.sql`
    FROM app_errors e
    WHERE e.env = ${env()} AND e.created_at >= ${since}
      AND ${inPeriod(Prisma.sql`e.created_at`, firstDay)}`;
  const [totals, groups, days] = await Promise.all([
    db.$queryRaw<{ total: number; people: number; routes: number }[]>`
      SELECT count(*)::int AS total, count(DISTINCT e.user_id)::int AS people,
        count(DISTINCT e.route)::int AS routes ${base}`,
    db.$queryRaw<ErrorGroup[]>`
      SELECT e.source, e.message, e.route, count(*)::int AS count,
        count(DISTINCT e.user_id)::int AS people, max(e.created_at) AS "lastAt"
      ${base}
      GROUP BY 1, 2, 3 ORDER BY 4 DESC, 6 DESC LIMIT 50`,
    db.$queryRaw<{ day: DayKey; errors: number }[]>`
      SELECT ${dayOf(Prisma.sql`e.created_at`)} AS day, count(*)::int AS errors
      ${base} GROUP BY 1`,
  ]);
  const perDay = new Map(days.map((row) => [row.day, row.errors]));
  return {
    total: totals[0]?.total ?? 0,
    people: totals[0]?.people ?? 0,
    routes: totals[0]?.routes ?? 0,
    groups,
    series: Array.from({ length: period }, (_, index) => {
      const day = addDays(firstDay, index);
      return { day, errors: perDay.get(day) ?? 0 };
    }),
  };
}

/** À regarder en ouvrant le dashboard : avis de la semaine, erreurs du jour. */
export async function getAlerts() {
  await requireAdmin();
  await io();
  const now = new Date();
  const rows = await db.$queryRaw<{ feedback: number; errors: number }[]>`
    SELECT
      (SELECT count(*)::int FROM feedback
        WHERE created_at >= ${new Date(now.getTime() - 7 * 86_400_000)}) AS feedback,
      (SELECT count(*)::int FROM app_errors
        WHERE env = ${env()} AND created_at >= ${new Date(now.getTime() - 86_400_000)}) AS errors`;
  return { feedback: rows[0]?.feedback ?? 0, errors: rows[0]?.errors ?? 0 };
}
