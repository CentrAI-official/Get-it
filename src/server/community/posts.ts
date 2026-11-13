import "server-only";
import type { Pillar } from "@/config/pillars";
import {
  DAILY_COMMENT_LIMIT,
  DAILY_POST_LIMIT,
  MIN_SHARED_STREAK,
  type CommunityError,
  type ProgressData,
} from "@/features/community/rules";
import type { PostMediaInput } from "@/features/community/media";
import { computeStreaks } from "@/features/habits/streak";
import { dayStreak, MIN_SHARED_DAY_STREAK } from "@/features/streaks/rules";
import { fromDbDate, toCalendarDay } from "@/lib/dates";
import { db } from "@/server/db";
import { lockFor } from "@/server/locks";
import { getUserTimeZone } from "@/server/profile/service";
import { frozenPact, listSuccessfulPacts } from "@/server/messages/pacts";
import { removeFiles } from "@/server/storage/service";
import { getDisplayLevels } from "@/server/levels/service";
import { getActivity } from "@/server/streaks/service";
import { notify } from "@/server/notifications/service";
import { postMediaPaths, verifyMedia } from "./media";
import { getBlockedIds, getCommunityMember } from "./members";

// Chaque fonction reçoit l'userId de la session et filtre dessus. Pas d'XP
// pour publier ou réagir : l'XP récompense les vrais progrès (§82).

const DAY_MS = 24 * 60 * 60 * 1000;
const since24h = () => new Date(Date.now() - DAY_MS);

type Result = { ok: true } | { ok: false; error: CommunityError };

/** Peut publier, commenter ou réagir : membre du Centre et pas suspendu. */
export async function canParticipate(userId: string): Promise<Result> {
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

/** Membre actif d'un groupe public : peut publier, commenter et réagir dans son forum. */
async function inGroupForum(groupId: string, userId: string) {
  const member = await db.groupMember.findFirst({
    where: {
      groupId,
      userId,
      status: "active",
      group: { visibility: "public" },
    },
    select: { userId: true },
  });
  return member !== null;
}

/** Publication de texte ou question (dans le fil, ou le forum d'un groupe public). */
export async function createPost(
  userId: string,
  input: {
    kind: "text" | "question";
    body: string;
    pillar?: Pillar;
    media: PostMediaInput;
    groupId?: string;
    /** Au nom de sa page pro (jamais dans un groupe). */
    asPage?: boolean;
  },
): Promise<Result> {
  const allowed = await canParticipate(userId);
  if (!allowed.ok) return allowed;
  let pageId: string | null = null;
  if (input.asPage) {
    if (input.groupId) return { ok: false, error: "notFound" };
    const page = await db.page.findUnique({
      where: { ownerId: userId },
      select: { id: true },
    });
    if (!page) return { ok: false, error: "notFound" };
    pageId = page.id;
  }
  if (input.groupId && !(await inGroupForum(input.groupId, userId))) {
    return { ok: false, error: "groupJoinRequired" };
  }
  if (!input.body && input.media.length === 0) {
    return { ok: false, error: "bodyRequired" };
  }
  if (!(await underPostLimit(userId))) return { ok: false, error: "postLimit" };
  // Fichiers vérifiés dans le stockage avant d'écrire quoi que ce soit
  const verified = await verifyMedia(userId, input.media);
  if (!verified.ok) return verified;
  const { rows, uploadIds } = verified.media;
  await db.$transaction(
    async (tx) => {
      const post = await tx.post.create({
        data: {
          userId,
          kind: input.kind,
          body: input.body,
          pillar: input.pillar ?? null,
          mediaCount: rows.length,
          groupId: input.groupId ?? null,
          pageId,
        },
        select: { id: true },
      });
      if (rows.length === 0) return;
      await tx.postMedia.createMany({
        data: rows.map((row) => {
          // Textes posés sur ce média (revalidés avec le reste des médias)
          const overlays = input.media[row.position]?.overlays ?? [];
          return {
            ...row,
            postId: post.id,
            ...(overlays.length > 0 ? { overlays } : {}),
          };
        }),
      });
      const { count } = await tx.mediaUpload.updateMany({
        where: { id: { in: uploadIds }, userId, usedAt: null },
        data: { usedAt: new Date() },
      });
      // Un même envoi ne sert qu'une fois
      if (count !== uploadIds.length) throw new Error("Média déjà utilisé");
      // Même marge que les annonces : la limite de 5 s par défaut est trop juste
    },
    { maxWait: 10_000, timeout: 20_000 },
  );
  return { ok: true };
}

export type ProgressSource =
  | { type: "goal" | "milestone" | "streak" | "pact"; id: string }
  | { type: "level" }
  | { type: "dayStreak" };

/**
 * Le progrès réel derrière une source, figé pour la publication, ou null si
 * l'utilisateur ne peut pas le partager (pas à lui, pas encore accompli…).
 */
export async function freezeProgress(
  userId: string,
  source: ProgressSource,
): Promise<ProgressData | null> {
  if (source.type === "pact") return frozenPact(userId, source.id);
  if (source.type === "level") {
    // Seul un niveau classé (mode Ranked) se partage : sinon il reste privé
    const level = (await getDisplayLevels([userId])).get(userId);
    return level === undefined ? null : { type: "level", level };
  }
  if (source.type === "dayStreak") {
    const days = await currentDayStreak(userId);
    return days >= MIN_SHARED_DAY_STREAK ? { type: "dayStreak", days } : null;
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

/** Série de jours actifs en cours (au moins une action par jour). */
async function currentDayStreak(userId: string) {
  const timeZone = await getUserTimeZone(userId);
  const activity = await getActivity(userId, timeZone);
  return dayStreak(activity.days, toCalendarDay(new Date(), timeZone)).current;
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
      pillar: "pillar" in progress ? progress.pillar : null,
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
  const [goals, milestones, streaks, levels, pacts, days] = await Promise.all([
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
    getDisplayLevels([userId]),
    listSuccessfulPacts(userId),
    currentDayStreak(userId),
  ]);
  const rankedLevel = levels.get(userId);
  const pactProgress = (
    await Promise.all(pacts.map((pact) => frozenPact(userId, pact.id)))
  ).flatMap((progress, index) => {
    const pact = pacts[index];
    return progress && pact
      ? [{ source: { type: "pact" as const, id: pact.id }, progress }]
      : [];
  });

  return [
    // Le niveau ne se partage qu'en mode Ranked (sinon il est privé)
    ...(rankedLevel === undefined
      ? []
      : [
          {
            source: { type: "level" as const },
            progress: { type: "level" as const, level: rankedLevel },
          },
        ]),
    ...(days >= MIN_SHARED_DAY_STREAK
      ? [
          {
            source: { type: "dayStreak" as const },
            progress: { type: "dayStreak" as const, days },
          },
        ]
      : []),
    ...pactProgress,
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
  const paths = await postMediaPaths(postId);
  const { count } = await db.post.deleteMany({ where: { id: postId, userId } });
  if (count > 0 && paths.length > 0) {
    await removeFiles(paths).catch((error: unknown) => {
      console.error("Fichiers d'une publication non supprimés", error);
    });
  }
  return count > 0;
}

/** Publication que l'utilisateur peut voir et avec laquelle il peut interagir. */
export async function reachablePost(userId: string, postId: string) {
  const blocked = await getBlockedIds(userId);
  return db.post.findFirst({
    where: {
      id: postId,
      status: "visible",
      ...(blocked.length > 0 ? { userId: { notIn: blocked } } : {}),
    },
    select: {
      id: true,
      userId: true,
      sharedPostId: true,
      groupId: true,
      pageId: true,
    },
  });
}

/**
 * Partage la publication de quelqu'un d'autre dans son fil, avec un mot
 * facultatif. Partager un partage renvoie à l'origine ; une même publication
 * n'est partagée qu'une fois par personne.
 */
export async function sharePost(
  userId: string,
  postId: string,
  body: string,
): Promise<Result> {
  const allowed = await canParticipate(userId);
  if (!allowed.ok) return allowed;
  let target = await reachablePost(userId, postId);
  if (target?.sharedPostId) {
    target = await reachablePost(userId, target.sharedPostId);
  }
  if (!target || target.userId === userId) {
    return { ok: false, error: "notFound" };
  }
  if (!(await underPostLimit(userId))) return { ok: false, error: "postLimit" };
  try {
    await db.post.create({
      data: { userId, kind: "text", body, sharedPostId: target.id },
      select: { id: true },
    });
  } catch (error) {
    // Index unique (personne, publication d'origine)
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return { ok: false, error: "alreadyShared" };
    }
    throw error;
  }
  return { ok: true };
}

/**
 * Commente une publication : au nom de sa page pro en mode page (`asPageId`,
 * retrouvée par la session), sinon en son nom.
 */
export async function addComment(
  userId: string,
  postId: string,
  body: string,
  asPageId: string | null = null,
): Promise<Result> {
  const allowed = await canParticipate(userId);
  if (!allowed.ok) return allowed;
  const post = await reachablePost(userId, postId);
  if (!post) return { ok: false, error: "notFound" };
  // Une page ne participe pas (encore) aux forums des groupes
  if (asPageId && post.groupId) return { ok: false, error: "notFound" };
  // Forum d'un groupe : il faut l'avoir rejoint pour y participer
  if (post.groupId && !(await inGroupForum(post.groupId, userId))) {
    return { ok: false, error: "groupJoinRequired" };
  }
  // Un commentaire à la fois par personne : des envois simultanés ne passent pas la limite
  const added = await db.$transaction(async (tx) => {
    await lockFor(tx, `comments:${userId}`);
    const count = await tx.postComment.count({
      where: { userId, createdAt: { gte: since24h() } },
    });
    if (count >= DAILY_COMMENT_LIMIT) return false;
    await tx.postComment.create({
      data: { postId, userId, body, pageId: asPageId },
    });
    return true;
  });
  if (!added) return { ok: false, error: "commentLimit" };
  await notify({
    userId: post.userId,
    kind: "comment",
    actorId: userId,
    actorPageId: asPageId,
    // Sous une publication d'une page : la cloche de la page
    pageId: post.pageId,
    href: `/community/posts/${postId}`,
    groupKey: `comment:${postId}`,
  });
  return { ok: true };
}

/**
 * Vue d'une vidéo (au moins 2 secondes regardées) : une par personne, jamais
 * l'auteur. Vrai si c'est une nouvelle vue.
 */
export async function recordVideoView(userId: string, postId: string) {
  const post = await reachablePost(userId, postId);
  if (!post || post.userId === userId) return false;
  const videos = await db.postMedia.count({ where: { postId, kind: "video" } });
  if (videos === 0) return false;
  const { count } = await db.postVideoView.createMany({
    data: [{ postId, userId }],
    skipDuplicates: true,
  });
  return count > 0;
}

export async function deleteComment(userId: string, commentId: string) {
  const { count } = await db.postComment.deleteMany({
    where: { id: commentId, userId },
  });
  return count > 0;
}

/**
 * « J'aime » sur la publication de quelqu'un d'autre (pas sur la sienne, ni
 * sur celle de sa page) : au nom de sa page pro en mode page (`asPageId`).
 */
export async function setReaction(
  userId: string,
  postId: string,
  on: boolean,
  asPageId: string | null = null,
): Promise<Result> {
  if (!on) {
    if (asPageId) {
      await db.postPageReaction.deleteMany({
        where: { postId, pageId: asPageId },
      });
    } else {
      await db.postReaction.deleteMany({ where: { postId, userId } });
    }
    return { ok: true };
  }
  const allowed = await canParticipate(userId);
  if (!allowed.ok) return allowed;
  const post = await reachablePost(userId, postId);
  if (!post || post.userId === userId) return { ok: false, error: "notFound" };
  if (asPageId && post.groupId) return { ok: false, error: "notFound" };
  if (post.groupId && !(await inGroupForum(post.groupId, userId))) {
    return { ok: false, error: "groupJoinRequired" };
  }
  let created: boolean;
  if (asPageId) {
    const { count } = await db.postPageReaction.createMany({
      data: [{ postId, pageId: asPageId }],
      skipDuplicates: true,
    });
    created = count > 0;
  } else {
    const { count } = await db.postReaction.createMany({
      data: [{ postId, userId }],
      skipDuplicates: true,
    });
    created = count > 0;
  }
  // Un nouveau « J'aime » seulement (pas un double-tap répété)
  if (created) {
    await notify({
      userId: post.userId,
      kind: "like",
      actorId: userId,
      actorPageId: asPageId,
      pageId: post.pageId,
      href: `/community/posts/${postId}`,
      groupKey: `like:${postId}`,
    });
  }
  return { ok: true };
}
