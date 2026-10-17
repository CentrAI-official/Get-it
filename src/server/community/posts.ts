import "server-only";
import type { Pillar } from "@/config/pillars";
import {
  DAILY_COMMENT_LIMIT,
  DAILY_POST_LIMIT,
  MIN_SHARED_STREAK,
  type CommunityError,
  type ProgressData,
} from "@/features/community/rules";
import { computeStreaks } from "@/features/habits/streak";
import { levelFromXp } from "@/features/xp/rules";
import { fromDbDate, toCalendarDay } from "@/lib/dates";
import { db } from "@/server/db";
import { getUserTimeZone } from "@/server/profile/service";
import { getXpTotals } from "@/server/xp/service";
import { getBlockedIds, getCommunityMember } from "./members";

// Chaque fonction reçoit l'userId de la session et filtre dessus. Pas d'XP
// pour publier ou réagir : l'XP récompense les vrais progrès (§82).

const DAY_MS = 24 * 60 * 60 * 1000;
const since24h = () => new Date(Date.now() - DAY_MS);

type Result = { ok: true } | { ok: false; error: CommunityError };

/** Peut publier, commenter ou réagir : membre du Centre et pas suspendu. */
async function canParticipate(userId: string): Promise<Result> {
  const member = await getCommunityMember(userId);
  if (!member?.joined) return { ok: false, error: "notJoined" };
  if (member.suspendedUntil) return { ok: false, error: "suspended" };
  return { ok: true };
}

/** Limite de publications sur 24 heures. */
async function underPostLimit(userId: string) {
  const count = await db.post.count({
    where: { userId, createdAt: { gte: since24h() } },
  });
  return count < DAILY_POST_LIMIT;
}

/** Publication de texte ou question. */
export async function createPost(
  userId: string,
  input: { kind: "text" | "question"; body: string; pillar?: Pillar },
): Promise<Result> {
  const allowed = await canParticipate(userId);
  if (!allowed.ok) return allowed;
  if (!(await underPostLimit(userId))) return { ok: false, error: "postLimit" };
  await db.post.create({
    data: {
      userId,
      kind: input.kind,
      body: input.body,
      pillar: input.pillar ?? null,
    },
  });
  return { ok: true };
}

export type ProgressSource =
  { type: "goal" | "milestone" | "streak"; id: string } | { type: "level" };

/**
 * Le progrès réel derrière une source, figé pour la publication, ou null si
 * l'utilisateur ne peut pas le partager (pas à lui, pas encore accompli…).
 */
export async function freezeProgress(
  userId: string,
  source: ProgressSource,
): Promise<ProgressData | null> {
  if (source.type === "level") {
    const xp = await getXpTotals(userId);
    return { type: "level", level: levelFromXp(xp.total).level };
  }
  if (source.type === "goal") {
    const goal = await db.goal.findFirst({
      where: { id: source.id, userId, completedAt: { not: null } },
      select: { title: true, pillar: true },
    });
    return goal
      ? { type: "goal", title: goal.title, pillar: goal.pillar }
      : null;
  }
  if (source.type === "milestone") {
    const milestone = await db.goalMilestone.findFirst({
      where: { id: source.id, goal: { userId }, completedAt: { not: null } },
      select: { title: true, goal: { select: { title: true, pillar: true } } },
    });
    return milestone
      ? {
          type: "milestone",
          title: milestone.title,
          goalTitle: milestone.goal.title,
          pillar: milestone.goal.pillar,
        }
      : null;
  }
  const streak = await currentStreaks(userId, source.id);
  const habit = streak[0];
  return habit && habit.days >= MIN_SHARED_STREAK
    ? {
        type: "streak",
        title: habit.title,
        days: habit.days,
        pillar: habit.pillar,
      }
    : null;
}

/** Séries en cours des habitudes actives (une seule si `habitId`). */
async function currentStreaks(userId: string, habitId?: string) {
  const timeZone = await getUserTimeZone(userId);
  const today = toCalendarDay(new Date(), timeZone);
  const habits = await db.habit.findMany({
    where: { userId, archivedAt: null, ...(habitId ? { id: habitId } : {}) },
    select: {
      id: true,
      title: true,
      pillar: true,
      weekdays: true,
      createdAt: true,
      completions: { select: { day: true } },
    },
  });
  return habits.map((habit) => ({
    id: habit.id,
    title: habit.title,
    pillar: habit.pillar,
    days: computeStreaks({
      weekdays: habit.weekdays,
      completions: new Set(habit.completions.map((c) => fromDbDate(c.day))),
      startDay: toCalendarDay(habit.createdAt, timeZone),
      today,
    }).current,
  }));
}

/** Partage d'un progrès réel, avec un message facultatif. */
export async function shareProgress(
  userId: string,
  source: ProgressSource,
  body: string,
): Promise<Result> {
  const allowed = await canParticipate(userId);
  if (!allowed.ok) return allowed;
  if (!(await underPostLimit(userId))) return { ok: false, error: "postLimit" };
  const progress = await freezeProgress(userId, source);
  if (!progress) return { ok: false, error: "notFound" };
  await db.post.create({
    data: {
      userId,
      kind: "progress",
      body,
      pillar: progress.type === "level" ? null : progress.pillar,
      progress,
    },
  });
  return { ok: true };
}

export type ShareableProgress = {
  source: ProgressSource;
  progress: ProgressData;
};

/** Progrès récents que l'utilisateur peut partager (proposés dans le Centre). */
export async function listShareableProgress(
  userId: string,
): Promise<ShareableProgress[]> {
  const recent = new Date(Date.now() - 60 * DAY_MS);
  const [goals, milestones, streaks, xp] = await Promise.all([
    db.goal.findMany({
      where: { userId, completedAt: { gte: recent } },
      orderBy: { completedAt: "desc" },
      take: 5,
      select: { id: true, title: true, pillar: true },
    }),
    db.goalMilestone.findMany({
      where: { goal: { userId }, completedAt: { gte: recent } },
      orderBy: { completedAt: "desc" },
      take: 5,
      select: {
        id: true,
        title: true,
        goal: { select: { title: true, pillar: true } },
      },
    }),
    currentStreaks(userId),
    getXpTotals(userId),
  ]);

  return [
    {
      source: { type: "level" },
      progress: { type: "level", level: levelFromXp(xp.total).level },
    },
    ...goals.map((goal): ShareableProgress => ({
      source: { type: "goal", id: goal.id },
      progress: { type: "goal", title: goal.title, pillar: goal.pillar },
    })),
    ...milestones.map((milestone): ShareableProgress => ({
      source: { type: "milestone", id: milestone.id },
      progress: {
        type: "milestone",
        title: milestone.title,
        goalTitle: milestone.goal.title,
        pillar: milestone.goal.pillar,
      },
    })),
    ...streaks
      .filter((habit) => habit.days >= MIN_SHARED_STREAK)
      .sort((a, b) => b.days - a.days)
      .slice(0, 3)
      .map((habit): ShareableProgress => ({
        source: { type: "streak", id: habit.id },
        progress: {
          type: "streak",
          title: habit.title,
          days: habit.days,
          pillar: habit.pillar,
        },
      })),
  ];
}

/** Supprime sa propre publication (et ses commentaires, réactions, signalements). */
export async function deletePost(userId: string, postId: string) {
  const { count } = await db.post.deleteMany({ where: { id: postId, userId } });
  return count > 0;
}

/** Publication que l'utilisateur peut voir et avec laquelle il peut interagir. */
async function reachablePost(userId: string, postId: string) {
  const blocked = await getBlockedIds(userId);
  return db.post.findFirst({
    where: {
      id: postId,
      status: "visible",
      ...(blocked.length > 0 ? { userId: { notIn: blocked } } : {}),
    },
    select: { id: true, userId: true },
  });
}

export async function addComment(
  userId: string,
  postId: string,
  body: string,
): Promise<Result> {
  const allowed = await canParticipate(userId);
  if (!allowed.ok) return allowed;
  if (!(await reachablePost(userId, postId))) {
    return { ok: false, error: "notFound" };
  }
  const count = await db.postComment.count({
    where: { userId, createdAt: { gte: since24h() } },
  });
  if (count >= DAILY_COMMENT_LIMIT) return { ok: false, error: "commentLimit" };
  await db.postComment.create({ data: { postId, userId, body } });
  return { ok: true };
}

export async function deleteComment(userId: string, commentId: string) {
  const { count } = await db.postComment.deleteMany({
    where: { id: commentId, userId },
  });
  return count > 0;
}

/** « Bravo » sur la publication de quelqu'un d'autre (pas sur la sienne). */
export async function setReaction(
  userId: string,
  postId: string,
  on: boolean,
): Promise<Result> {
  if (!on) {
    await db.postReaction.deleteMany({ where: { postId, userId } });
    return { ok: true };
  }
  const allowed = await canParticipate(userId);
  if (!allowed.ok) return allowed;
  const post = await reachablePost(userId, postId);
  if (!post || post.userId === userId) return { ok: false, error: "notFound" };
  await db.postReaction.upsert({
    where: { postId_userId: { postId, userId } },
    update: {},
    create: { postId, userId },
  });
  return { ok: true };
}
