import "server-only";
import {
  DAILY_FOLLOW_LIMIT,
  FOLLOW_LIST_SIZE,
  type FollowError,
  type FollowList,
} from "@/features/follows/rules";
import { getBlockedIds, getCommunityMember } from "@/server/community/members";
import { db } from "@/server/db";
import { notify } from "@/server/notifications/service";
import { avatarUrls } from "@/server/profile/avatar";

// Abonnements entre membres du Centre. Chaque fonction reçoit l'userId de la
// session ; les listes se voient par les membres, sans les personnes bloquées.

export type FollowPerson = {
  id: string;
  displayName: string | null;
  username: string;
  avatarUrl: string | null;
  /** Je suis cette personne (bouton « Abonné »). */
  following: boolean;
  mine: boolean;
};

/** Suivre (ou ne plus suivre) un membre du Centre. */
export async function setFollow(
  viewerId: string,
  targetId: string,
  follow: boolean,
): Promise<
  { ok: true; following: boolean } | { ok: false; error: FollowError }
> {
  if (viewerId === targetId) return { ok: false, error: "self" };
  if (!follow) {
    await db.follow.deleteMany({
      where: { followerId: viewerId, followedId: targetId },
    });
    return { ok: true, following: false };
  }
  const [viewer, target, blocked] = await Promise.all([
    getCommunityMember(viewerId),
    getCommunityMember(targetId),
    getBlockedIds(viewerId),
  ]);
  if (!viewer?.joined) return { ok: false, error: "notJoined" };
  if (viewer.suspendedUntil) return { ok: false, error: "suspended" };
  if (!target?.joined || blocked.includes(targetId)) {
    return { ok: false, error: "notFound" };
  }
  const recent = await db.follow.count({
    where: {
      followerId: viewerId,
      createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  });
  if (recent >= DAILY_FOLLOW_LIMIT) return { ok: false, error: "followLimit" };
  const created = await db.follow.createMany({
    data: [{ followerId: viewerId, followedId: targetId }],
    skipDuplicates: true,
  });
  if (created.count > 0 && viewer.username) {
    await notify({
      userId: targetId,
      kind: "follow",
      actorId: viewerId,
      href: `/community/members/${viewer.username}`,
      groupKey: `follow:${viewerId}`,
    });
  }
  return { ok: true, following: true };
}

/** Nombre d'abonnés et d'abonnements (personnes bloquées par le lecteur exclues). */
export async function followCounts(viewerId: string, userId: string) {
  const blocked = await getBlockedIds(viewerId);
  const [followers, following, mine] = await Promise.all([
    db.follow.count({
      where: { followedId: userId, followerId: { notIn: blocked } },
    }),
    db.follow.count({
      where: { followerId: userId, followedId: { notIn: blocked } },
    }),
    viewerId === userId
      ? null
      : db.follow.findUnique({
          where: {
            followerId_followedId: { followerId: viewerId, followedId: userId },
          },
          select: { createdAt: true },
        }),
  ]);
  return { followers, following, isFollowing: Boolean(mine) };
}

/** Les comptes que je suis (fil « Abonnements »). */
export async function followingIds(viewerId: string) {
  const rows = await db.follow.findMany({
    where: { followerId: viewerId },
    select: { followedId: true },
  });
  return rows.map((row) => row.followedId);
}

/**
 * Abonnés ou abonnements d'un membre, vus par un autre membre : les plus
 * récents d'abord, sans les personnes bloquées (dans les deux sens).
 */
export async function listFollows(
  viewerId: string,
  userId: string,
  list: FollowList,
): Promise<FollowPerson[]> {
  const blocked = await getBlockedIds(viewerId);
  const rows = await db.follow.findMany({
    where:
      list === "followers"
        ? { followedId: userId, followerId: { notIn: blocked } }
        : { followerId: userId, followedId: { notIn: blocked } },
    orderBy: { createdAt: "desc" },
    take: FOLLOW_LIST_SIZE,
    select: { followerId: true, followedId: true },
  });
  const ids = rows.map((row) =>
    list === "followers" ? row.followerId : row.followedId,
  );
  const [profiles, mine] = await Promise.all([
    db.profile.findMany({
      where: {
        id: { in: ids },
        username: { not: null },
        settings: { communityRulesAt: { not: null } },
      },
      select: { id: true, displayName: true, username: true, avatarPath: true },
    }),
    db.follow.findMany({
      where: { followerId: viewerId, followedId: { in: ids } },
      select: { followedId: true },
    }),
  ]);
  const avatars = await avatarUrls(profiles.map((row) => row.avatarPath));
  const following = new Set(mine.map((row) => row.followedId));
  const byId = new Map(profiles.map((row) => [row.id, row]));
  return ids.flatMap((id) => {
    const person = byId.get(id);
    if (!person?.username) return [];
    return [
      {
        id: person.id,
        displayName: person.displayName,
        username: person.username,
        avatarUrl: person.avatarPath
          ? (avatars.get(person.avatarPath) ?? null)
          : null,
        following: following.has(person.id),
        mine: person.id === viewerId,
      },
    ];
  });
}
