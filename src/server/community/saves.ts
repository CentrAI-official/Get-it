import "server-only";
import {
  FEED_PAGE_SIZE,
  MAX_SAVED_POSTS,
  type CommunityError,
} from "@/features/community/rules";
import { db } from "@/server/db";
import {
  postSelect,
  toFeedPosts,
  visibleTo,
  type FeedCursor,
  type FeedPost,
} from "./feed";
import { getBlockedIds, getCommunityMember } from "./members";

// Publications enregistrées : privées (jamais montrées à l'auteur), effacées
// avec le compte ou la publication. Un compte suspendu peut encore enregistrer :
// il lit le Centre, il n'y écrit pas.

/** Enregistre (ou retire) une publication que la personne peut lire. */
export async function setPostSaved(
  userId: string,
  postId: string,
  saved: boolean,
): Promise<{ ok: true } | { ok: false; error: CommunityError }> {
  const member = await getCommunityMember(userId);
  if (!member?.joined) return { ok: false, error: "notJoined" };
  if (!saved) {
    await db.postSave.deleteMany({ where: { userId, postId } });
    return { ok: true };
  }
  const blocked = await getBlockedIds(userId);
  const post = await db.post.findFirst({
    where: {
      id: postId,
      ...visibleTo(userId),
      ...(blocked.length > 0 ? { userId: { notIn: blocked } } : {}),
    },
    select: { id: true },
  });
  if (!post) return { ok: false, error: "notFound" };
  const count = await db.postSave.count({ where: { userId } });
  if (count >= MAX_SAVED_POSTS) return { ok: false, error: "saveLimit" };
  await db.postSave.createMany({
    data: [{ userId, postId }],
    skipDuplicates: true,
  });
  return { ok: true };
}

/**
 * Mes publications enregistrées, de la plus récemment enregistrée à la plus
 * ancienne ; celles devenues illisibles (retirées, auteur bloqué) sont sautées.
 * Le curseur porte le moment de l'enregistrement et l'id de la publication.
 */
export async function listSavedPosts(
  viewerId: string,
  cursor?: FeedCursor,
): Promise<{
  posts: FeedPost[];
  nextCursor: FeedCursor | null;
  loadedAt: number;
}> {
  const blocked = await getBlockedIds(viewerId);
  const rows = await db.postSave.findMany({
    where: {
      userId: viewerId,
      post: {
        ...visibleTo(viewerId),
        ...(blocked.length > 0 ? { userId: { notIn: blocked } } : {}),
      },
      ...(cursor
        ? {
            OR: [
              { createdAt: { lt: new Date(cursor.createdAt) } },
              {
                createdAt: new Date(cursor.createdAt),
                postId: { lt: cursor.id },
              },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }, { postId: "desc" }],
    take: FEED_PAGE_SIZE + 1,
    select: {
      createdAt: true,
      postId: true,
      post: { select: postSelect(viewerId, blocked) },
    },
  });
  const page = rows.slice(0, FEED_PAGE_SIZE);
  const last = page.at(-1);
  return {
    posts: await toFeedPosts(
      page.map((row) => row.post),
      viewerId,
    ),
    nextCursor:
      rows.length > FEED_PAGE_SIZE && last
        ? { createdAt: last.createdAt.toISOString(), id: last.postId }
        : null,
    loadedAt: Date.now(),
  };
}
