import "server-only";
import {
  FEED_PAGE_SIZE,
  progressDataSchema,
  type ProgressData,
} from "@/features/community/rules";
import type { Pillar } from "@/config/pillars";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { getLevels } from "@/server/xp/service";
import { getBlockedIds } from "./members";

// Le fil est chronologique (§82 : pas d'algorithme qui pousse à scroller).
// Chaque lecture exclut les personnes bloquées, dans les deux sens.

export type FeedAuthor = {
  id: string;
  displayName: string | null;
  username: string | null;
  level: number;
};

export type FeedPost = {
  id: string;
  kind: "text" | "question" | "progress";
  body: string;
  pillar: Pillar | null;
  progress: ProgressData | null;
  /** Masquée après des signalements : seul l'auteur la voit encore. */
  hidden: boolean;
  /** « AAAA-MM-JJTHH:MM:SS.sssZ » */
  createdAt: string;
  author: FeedAuthor;
  reactions: number;
  reacted: boolean;
  comments: number;
  mine: boolean;
};

export type FeedComment = {
  id: string;
  body: string;
  hidden: boolean;
  createdAt: string;
  author: Omit<FeedAuthor, "level">;
  mine: boolean;
};

/** Curseur de pagination : la dernière publication déjà affichée. */
export type FeedCursor = { createdAt: string; id: string };

/** Contenu visible pour l'utilisateur : visible, ou masqué mais à lui. */
function visibleTo(viewerId: string) {
  return {
    OR: [
      { status: "visible" as const },
      { status: "hidden" as const, userId: viewerId },
    ],
  };
}

/** Une page du fil, de la plus récente à la plus ancienne. */
export async function listFeed(
  viewerId: string,
  cursor?: FeedCursor,
): Promise<{
  posts: FeedPost[];
  nextCursor: FeedCursor | null;
  /** Moment du chargement : base des dates relatives (« il y a 5 min »). */
  loadedAt: number;
}> {
  const blocked = await getBlockedIds(viewerId);
  const where: Prisma.PostWhereInput = {
    AND: [
      visibleTo(viewerId),
      blocked.length > 0 ? { userId: { notIn: blocked } } : {},
      cursor
        ? {
            OR: [
              { createdAt: { lt: new Date(cursor.createdAt) } },
              { createdAt: new Date(cursor.createdAt), id: { lt: cursor.id } },
            ],
          }
        : {},
    ],
  };

  const rows = await db.post.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: FEED_PAGE_SIZE + 1,
    select: {
      id: true,
      kind: true,
      body: true,
      pillar: true,
      progress: true,
      status: true,
      createdAt: true,
      userId: true,
      profile: { select: { displayName: true, username: true } },
      reactions: { where: { userId: viewerId }, select: { userId: true } },
      _count: {
        select: {
          reactions: true,
          comments: {
            where: {
              status: "visible",
              ...(blocked.length > 0 ? { userId: { notIn: blocked } } : {}),
            },
          },
        },
      },
    },
  });

  const page = rows.slice(0, FEED_PAGE_SIZE);
  const levels = await getLevels([...new Set(page.map((post) => post.userId))]);
  const last = page.at(-1);

  return {
    posts: page.map((post) => {
      const progress = post.progress
        ? progressDataSchema.safeParse(post.progress)
        : null;
      return {
        id: post.id,
        kind: post.kind,
        body: post.body,
        pillar: post.pillar,
        progress: progress?.success ? progress.data : null,
        hidden: post.status === "hidden",
        createdAt: post.createdAt.toISOString(),
        author: {
          id: post.userId,
          displayName: post.profile.displayName,
          username: post.profile.username,
          level: levels.get(post.userId) ?? 1,
        },
        reactions: post._count.reactions,
        reacted: post.reactions.length > 0,
        comments: post._count.comments,
        mine: post.userId === viewerId,
      };
    }),
    nextCursor:
      rows.length > FEED_PAGE_SIZE && last
        ? { createdAt: last.createdAt.toISOString(), id: last.id }
        : null,
    loadedAt: Date.now(),
  };
}

/** Commentaires d'une publication visible, du plus ancien au plus récent. */
export async function listComments(
  viewerId: string,
  postId: string,
): Promise<FeedComment[] | null> {
  const blocked = await getBlockedIds(viewerId);
  const post = await db.post.findFirst({
    where: {
      id: postId,
      ...visibleTo(viewerId),
      ...(blocked.length > 0 ? { userId: { notIn: blocked } } : {}),
    },
    select: { id: true },
  });
  if (!post) return null;

  const comments = await db.postComment.findMany({
    where: {
      postId,
      ...visibleTo(viewerId),
      ...(blocked.length > 0 ? { userId: { notIn: blocked } } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: 100,
    select: {
      id: true,
      body: true,
      status: true,
      createdAt: true,
      userId: true,
      profile: { select: { displayName: true, username: true } },
    },
  });
  return comments.map((comment) => ({
    id: comment.id,
    body: comment.body,
    hidden: comment.status === "hidden",
    createdAt: comment.createdAt.toISOString(),
    author: {
      id: comment.userId,
      displayName: comment.profile.displayName,
      username: comment.profile.username,
    },
    mine: comment.userId === viewerId,
  }));
}
