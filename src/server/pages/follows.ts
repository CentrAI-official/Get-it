import "server-only";
import { DAILY_FOLLOW_LIMIT } from "@/features/follows/rules";
import { getBlockedIds, getCommunityMember } from "@/server/community/members";
import { db } from "@/server/db";
import { notify } from "@/server/notifications/service";

// S'abonner à une page pro : ses publications vont dans le fil « Abonnements ».
// Qui suit une page reste privé ; seul leur nombre se voit. Chaque fonction
// reçoit l'userId de la session.

const DAY_MS = 24 * 60 * 60 * 1000;

/** Les pages que la personne suit (pour le fil « Abonnements »). */
export async function followedPageIds(viewerId: string) {
  const rows = await db.pageFollow.findMany({
    where: { followerId: viewerId },
    select: { pageId: true },
  });
  return rows.map((row) => row.pageId);
}

/** Le nombre d'abonnés d'une page, et si la personne en fait partie. */
export async function pageFollowState(viewerId: string, pageId: string) {
  const [followers, mine] = await Promise.all([
    db.pageFollow.count({ where: { pageId } }),
    db.pageFollow.count({ where: { pageId, followerId: viewerId } }),
  ]);
  return { followers, following: mine > 0 };
}

export type PageFollowError =
  "notFound" | "notJoined" | "suspended" | "followLimit";

/**
 * S'abonne à une page, ou se désabonne. Il faut être membre du Centre ; pas sa
 * propre page, ni celle d'une personne bloquée (dans un sens ou dans l'autre).
 */
export async function setPageFollow(
  viewerId: string,
  pageId: string,
  follow: boolean,
): Promise<{ ok: true } | { ok: false; error: PageFollowError }> {
  if (!follow) {
    await db.pageFollow.deleteMany({
      where: { pageId, followerId: viewerId },
    });
    return { ok: true };
  }
  const member = await getCommunityMember(viewerId);
  if (!member?.joined) return { ok: false, error: "notJoined" };
  if (member.suspendedUntil) return { ok: false, error: "suspended" };
  const page = await db.page.findUnique({
    where: { id: pageId },
    select: { ownerId: true },
  });
  if (!page || page.ownerId === viewerId) {
    return { ok: false, error: "notFound" };
  }
  const blocked = await getBlockedIds(viewerId);
  if (blocked.includes(page.ownerId)) return { ok: false, error: "notFound" };
  // Même limite que les abonnements aux membres, comptée ensemble
  const since = new Date(Date.now() - DAY_MS);
  const [people, pages] = await Promise.all([
    db.follow.count({
      where: { followerId: viewerId, createdAt: { gte: since } },
    }),
    db.pageFollow.count({
      where: { followerId: viewerId, createdAt: { gte: since } },
    }),
  ]);
  if (people + pages >= DAILY_FOLLOW_LIMIT) {
    return { ok: false, error: "followLimit" };
  }
  const { count } = await db.pageFollow.createMany({
    data: [{ pageId, followerId: viewerId }],
    skipDuplicates: true,
  });
  // Un nouvel abonné : la cloche de la page
  if (count > 0 && member.username) {
    await notify({
      userId: page.ownerId,
      pageId,
      kind: "follow",
      actorId: viewerId,
      href: `/community/members/${member.username}`,
      groupKey: `page-follow:${viewerId}`,
    });
  }
  return { ok: true };
}
