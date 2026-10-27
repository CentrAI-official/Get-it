import "server-only";
import {
  FEED_PAGE_SIZE,
  progressDataSchema,
  type ProgressData,
} from "@/features/community/rules";
import type { Pillar } from "@/config/pillars";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { avatarUrls } from "@/server/profile/avatar";
import { getDisplayLevels } from "@/server/ranked/service";
import { mediaForPosts, type FeedMedia } from "./media";
import { getBlockedIds } from "./members";

// Le fil est chronologique (§82 : pas d'algorithme qui pousse à scroller).
// Chaque lecture exclut les personnes bloquées, dans les deux sens.

export type FeedAuthor = {
  id: string;
  displayName: string | null;
  username: string | null;
  /** Photo de profil (lien temporaire), ou null : l'initiale est montrée. */
  avatarUrl: string | null;
  /** Niveau classé (mode Ranked), ou null : sans Ranked, le niveau reste privé. */
  level: number | null;
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
  /** Photos ou vidéo, avec des liens de lecture temporaires. */
  media: FeedMedia[];
  /** Enregistrée par la personne qui lit (privé). */
  saved: boolean;
  /**
   * Partage : la publication d'origine telle que la personne qui lit peut la
   * voir, ou « unavailable » (masquée, retirée, ou auteur bloqué).
   */
  shared: SharedPost | "unavailable" | null;
  /** Forum d'un groupe public d'où vient la publication. */
  group: { id: string; name: string } | null;
};

/** Publication d'origine d'un partage, ou envoyée dans une conversation. */
export type SharedPost = Pick<
  FeedPost,
  | "id"
  | "kind"
  | "body"
  | "pillar"
  | "progress"
  | "createdAt"
  | "author"
  | "media"
>;

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
export function visibleTo(viewerId: string) {
  return {
    OR: [
      { status: "visible" as const },
      { status: "hidden" as const, userId: viewerId },
    ],
  };
}

/** Colonnes d'une publication du fil, vue par `viewerId`. */
export function postSelect(viewerId: string, blocked: readonly string[]) {
  return {
    id: true,
    kind: true,
    body: true,
    pillar: true,
    progress: true,
    status: true,
    mediaCount: true,
    sharedPostId: true,
    createdAt: true,
    userId: true,
    group: { select: { id: true, name: true } },
    profile: {
      select: { displayName: true, username: true, avatarPath: true },
    },
    reactions: { where: { userId: viewerId }, select: { userId: true } },
    saves: { where: { userId: viewerId }, select: { userId: true } },
    _count: {
      select: {
        reactions: true,
        comments: {
          where: {
            status: "visible" as const,
            ...(blocked.length > 0 ? { userId: { notIn: [...blocked] } } : {}),
          },
        },
      },
    },
  } satisfies Prisma.PostSelect;
}

type PostRow = Prisma.PostGetPayload<{
  select: ReturnType<typeof postSelect>;
}>;

/**
 * Publications lisibles par `viewerId` parmi `ids` (visibles, auteur non
 * bloqué dans un sens ou dans l'autre), prêtes à afficher en aperçu.
 */
export async function sharedPostsFor(
  viewerId: string,
  ids: readonly string[],
): Promise<Map<string, SharedPost>> {
  const result = new Map<string, SharedPost>();
  if (ids.length === 0) return result;
  const blocked = await getBlockedIds(viewerId);
  const rows = await db.post.findMany({
    where: {
      id: { in: [...new Set(ids)] },
      ...visibleTo(viewerId),
      ...(blocked.length > 0 ? { userId: { notIn: blocked } } : {}),
    },
    select: postSelect(viewerId, blocked),
  });
  for (const post of await toFeedPosts(rows, viewerId)) {
    result.set(post.id, {
      id: post.id,
      kind: post.kind,
      body: post.body,
      pillar: post.pillar,
      progress: post.progress,
      createdAt: post.createdAt,
      author: post.author,
      media: post.media,
    });
  }
  return result;
}

/** Publications prêtes à afficher : médias, niveaux et photos des auteurs. */
export async function toFeedPosts(
  rows: readonly PostRow[],
  viewerId: string,
): Promise<FeedPost[]> {
  const sharedIds = rows.flatMap((post) =>
    post.sharedPostId ? [post.sharedPostId] : [],
  );
  const [media, shared] = await Promise.all([
    mediaForPosts(
      rows.filter((post) => post.mediaCount > 0).map((post) => post.id),
    ),
    // Une publication d'origine n'est jamais elle-même un partage : un seul niveau
    sharedPostsFor(viewerId, sharedIds),
  ]);
  const [levels, avatars] = await Promise.all([
    getDisplayLevels([...new Set(rows.map((post) => post.userId))]),
    avatarUrls(rows.map((post) => post.profile.avatarPath)),
  ]);

  return rows.map((post) => {
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
        avatarUrl: post.profile.avatarPath
          ? (avatars.get(post.profile.avatarPath) ?? null)
          : null,
        level: levels.get(post.userId) ?? null,
      },
      reactions: post._count.reactions,
      reacted: post.reactions.length > 0,
      comments: post._count.comments,
      mine: post.userId === viewerId,
      media: media.get(post.id) ?? [],
      saved: post.saves.length > 0,
      shared: post.sharedPostId
        ? (shared.get(post.sharedPostId) ?? "unavailable")
        : null,
      group: post.group,
    };
  });
}

/** Une publication visible (lien « Copier le lien », réservé aux membres), ou null. */
export async function getFeedPost(
  viewerId: string,
  postId: string,
): Promise<{ post: FeedPost; loadedAt: number } | null> {
  const blocked = await getBlockedIds(viewerId);
  const row = await db.post.findFirst({
    where: {
      id: postId,
      ...visibleTo(viewerId),
      ...(blocked.length > 0 ? { userId: { notIn: blocked } } : {}),
    },
    select: postSelect(viewerId, blocked),
  });
  if (!row) return null;
  const [post] = await toFeedPosts([row], viewerId);
  return post ? { post, loadedAt: Date.now() } : null;
}

/**
 * Une page du fil, de la plus récente à la plus ancienne ; avec `authorId`,
 * seulement les publications de cette personne (son profil) ; avec
 * `groupId`, le forum de ce groupe public. Les publications des groupes
 * restent hors du fil du Centre et des profils.
 */
export async function listFeed(
  viewerId: string,
  cursor?: FeedCursor,
  authorId?: string,
  groupId?: string,
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
      authorId ? { userId: authorId } : {},
      groupId
        ? { groupId, group: { visibility: "public" as const } }
        : { groupId: null },
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
    select: postSelect(viewerId, blocked),
  });

  const page = rows.slice(0, FEED_PAGE_SIZE);
  const last = page.at(-1);

  return {
    posts: await toFeedPosts(page, viewerId),
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
      profile: {
        select: { displayName: true, username: true, avatarPath: true },
      },
    },
  });
  const avatars = await avatarUrls(
    comments.map((comment) => comment.profile.avatarPath),
  );
  return comments.map((comment) => ({
    id: comment.id,
    body: comment.body,
    hidden: comment.status === "hidden",
    createdAt: comment.createdAt.toISOString(),
    author: {
      id: comment.userId,
      displayName: comment.profile.displayName,
      username: comment.profile.username,
      avatarUrl: comment.profile.avatarPath
        ? (avatars.get(comment.profile.avatarPath) ?? null)
        : null,
    },
    mine: comment.userId === viewerId,
  }));
}
