import "server-only";
import type { Pillar } from "@/config/pillars";
import {
  canManage,
  canRemove,
  DAILY_GROUP_INVITES,
  GROUP_PAGE_SIZE,
  MAX_OWNED_GROUPS,
  MAX_PRIVATE_MEMBERS,
  topicOf,
  type GroupError,
  type GroupFilters,
  type GroupFormInput,
  type GroupRole,
  type GroupTopic,
  type GroupVisibility,
} from "@/features/groups/rules";
import type { Prisma } from "@/generated/prisma/client";
import { getBlockedIds } from "@/server/community/members";
import { canParticipate } from "@/server/community/posts";
import { db } from "@/server/db";
import { avatarUrls } from "@/server/profile/avatar";
import { removeFiles } from "@/server/storage/service";

// Groupes : chaque fonction reçoit l'userId de la session et revérifie le rôle
// de la personne dans le groupe. Un groupe privé n'existe que pour ses membres
// (et ses invités) ; un groupe public se lit par tout membre du Centre. Les
// personnes bloquées (dans un sens ou dans l'autre) ne se croisent pas : pas
// d'invitation, et le groupe d'un créateur bloqué n'apparaît pas.

type Fail = { ok: false; error: GroupError };
type Result<T = object> = ({ ok: true } & T) | Fail;

const DAY_MS = 24 * 60 * 60 * 1000;

export type GroupSummary = {
  id: string;
  name: string;
  description: string;
  topic: GroupTopic;
  visibility: GroupVisibility;
  memberCount: number;
  /** Rôle de la personne qui lit ; null si elle n'est pas membre. */
  role: GroupRole | null;
  /** « invited » : invitation à un groupe privé, pas encore acceptée. */
  status: "active" | "invited" | null;
  /** Discussion d'un groupe privé (membres seulement). */
  conversationId: string | null;
};

export type GroupPerson = {
  id: string;
  displayName: string | null;
  username: string | null;
  avatarUrl: string | null;
};

export type GroupMemberItem = {
  person: GroupPerson;
  role: GroupRole;
  status: "active" | "invited";
};

const groupSelect = (viewerId: string) =>
  ({
    id: true,
    name: true,
    description: true,
    pillar: true,
    visibility: true,
    ownerId: true,
    members: {
      where: { userId: viewerId },
      select: { role: true, status: true },
    },
    conversation: { select: { id: true } },
    _count: { select: { members: { where: { status: "active" } } } },
  }) satisfies Prisma.GroupSelect;

type GroupRow = Prisma.GroupGetPayload<{
  select: ReturnType<typeof groupSelect>;
}>;

function toSummary(row: GroupRow): GroupSummary {
  const mine = row.members[0];
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    topic: topicOf(row.pillar),
    visibility: row.visibility,
    memberCount: row._count.members,
    role: mine?.status === "active" ? mine.role : null,
    status: mine?.status ?? null,
    conversationId:
      mine?.status === "active" ? (row.conversation?.id ?? null) : null,
  };
}

/** Groupe visible pour `viewerId` : public (créateur non bloqué), ou privé dont il est membre ou invité. */
function readableWhere(
  viewerId: string,
  blocked: readonly string[],
): Prisma.GroupWhereInput {
  return {
    ...(blocked.length > 0 ? { ownerId: { notIn: [...blocked] } } : {}),
    OR: [{ visibility: "public" }, { members: { some: { userId: viewerId } } }],
  };
}

async function persons(ids: string[]): Promise<Map<string, GroupPerson>> {
  const profiles = await db.profile.findMany({
    where: { id: { in: ids } },
    select: { id: true, displayName: true, username: true, avatarPath: true },
  });
  const avatars = await avatarUrls(profiles.map((p) => p.avatarPath));
  return new Map(
    profiles.map(({ avatarPath, ...profile }) => [
      profile.id,
      {
        ...profile,
        avatarUrl: avatarPath ? (avatars.get(avatarPath) ?? null) : null,
      },
    ]),
  );
}

async function membership(groupId: string, userId: string) {
  return db.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: { role: true, status: true },
  });
}

/** Mes groupes (membre actif) et mes invitations, les plus récents d'abord. */
export async function listMyGroups(viewerId: string) {
  const rows = await db.group.findMany({
    where: { members: { some: { userId: viewerId } } },
    orderBy: { updatedAt: "desc" },
    select: groupSelect(viewerId),
  });
  const groups = rows.map(toSummary);
  return {
    groups: groups.filter((group) => group.status === "active"),
    invitations: groups.filter((group) => group.status === "invited"),
  };
}

/** Annuaire des groupes publics : par pilier (ou général) et par nom. */
export async function listPublicGroups(
  viewerId: string,
  filters: GroupFilters,
): Promise<GroupSummary[]> {
  const blocked = await getBlockedIds(viewerId);
  const rows = await db.group.findMany({
    where: {
      visibility: "public",
      ...(blocked.length > 0 ? { ownerId: { notIn: blocked } } : {}),
      ...(filters.topic
        ? { pillar: filters.topic === "general" ? null : filters.topic }
        : {}),
      ...(filters.q
        ? { name: { contains: filters.q, mode: "insensitive" as const } }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: GROUP_PAGE_SIZE,
    select: groupSelect(viewerId),
  });
  return rows.map(toSummary);
}

/** Un groupe, s'il est visible pour la personne ; null sinon. */
export async function getGroup(
  viewerId: string,
  groupId: string,
): Promise<(GroupSummary & { ownerId: string }) | null> {
  const blocked = await getBlockedIds(viewerId);
  const row = await db.group.findFirst({
    where: { id: groupId, ...readableWhere(viewerId, blocked) },
    select: groupSelect(viewerId),
  });
  return row ? { ...toSummary(row), ownerId: row.ownerId } : null;
}

const pillarOf = (topic: GroupTopic): Pillar | null =>
  topic === "general" ? null : topic;

/**
 * Crée un groupe (10 au plus par personne) ; la personne en devient le
 * créateur. Un groupe privé reçoit sa discussion dans la Messagerie.
 */
export async function createGroup(
  userId: string,
  input: GroupFormInput,
): Promise<Result<{ id: string }>> {
  const allowed = await canParticipate(userId);
  if (!allowed.ok) {
    return {
      ok: false,
      error: allowed.error === "suspended" ? "suspended" : "notJoined",
    };
  }
  const owned = await db.group.count({ where: { ownerId: userId } });
  if (owned >= MAX_OWNED_GROUPS) return { ok: false, error: "groupLimit" };
  const now = new Date();
  const group = await db.$transaction(async (tx) => {
    const created = await tx.group.create({
      data: {
        name: input.name,
        description: input.description,
        pillar: pillarOf(input.topic),
        visibility: input.visibility,
        ownerId: userId,
        members: {
          create: { userId, role: "owner", status: "active", joinedAt: now },
        },
      },
      select: { id: true },
    });
    if (input.visibility === "private") {
      await tx.conversation.create({
        data: {
          groupId: created.id,
          createdById: userId,
          members: { create: { userId, status: "accepted", lastReadAt: now } },
        },
      });
    }
    return created;
  });
  return { ok: true, id: group.id };
}

/** Modifie le nom, la description ou le pilier (le créateur et les admins). */
export async function updateGroup(
  userId: string,
  groupId: string,
  input: GroupFormInput,
): Promise<Result> {
  const mine = await membership(groupId, userId);
  if (mine?.status !== "active" || !canManage(mine.role)) {
    return { ok: false, error: "notAllowed" };
  }
  await db.group.update({
    where: { id: groupId },
    data: {
      name: input.name,
      description: input.description,
      pillar: pillarOf(input.topic),
    },
  });
  return { ok: true };
}

/** Rejoindre un groupe public. */
export async function joinGroup(
  userId: string,
  groupId: string,
): Promise<Result> {
  const allowed = await canParticipate(userId);
  if (!allowed.ok) {
    return {
      ok: false,
      error: allowed.error === "suspended" ? "suspended" : "notJoined",
    };
  }
  const group = await getGroup(userId, groupId);
  if (!group || group.visibility !== "public")
    return { ok: false, error: "notFound" };
  if (group.status === "active") return { ok: true };
  await db.groupMember.upsert({
    where: { groupId_userId: { groupId, userId } },
    update: { status: "active", joinedAt: new Date() },
    create: { groupId, userId, status: "active", joinedAt: new Date() },
  });
  await touch(groupId);
  return { ok: true };
}

/** Quitter un groupe (le créateur ne part pas : il supprime le groupe). */
export async function leaveGroup(
  userId: string,
  groupId: string,
): Promise<Result> {
  const mine = await membership(groupId, userId);
  if (!mine) return { ok: false, error: "notFound" };
  if (mine.role === "owner") return { ok: false, error: "ownerCannotLeave" };
  await removeMembership(groupId, userId);
  return { ok: true };
}

async function removeMembership(groupId: string, userId: string) {
  await db.$transaction([
    db.groupMember.deleteMany({ where: { groupId, userId } }),
    // Discussion d'un groupe privé : la personne n'y a plus accès
    db.conversationMember.deleteMany({
      where: { userId, conversation: { groupId } },
    }),
  ]);
}

/** Le groupe remonte dans « Mes groupes » quand il se passe quelque chose. */
async function touch(groupId: string) {
  await db.group.update({
    where: { id: groupId },
    data: { updatedAt: new Date() },
  });
}

/**
 * Invite un membre du Centre dans un groupe privé (le créateur et les admins).
 * L'invitation attend son accord ; 20 personnes au plus, invitations comprises.
 */
export async function inviteToGroup(
  actorId: string,
  groupId: string,
  targetId: string,
): Promise<Result> {
  if (actorId === targetId) return { ok: false, error: "alreadyMember" };
  const [mine, group] = await Promise.all([
    membership(groupId, actorId),
    db.group.findUnique({
      where: { id: groupId },
      select: { visibility: true, _count: { select: { members: true } } },
    }),
  ]);
  if (!group || mine?.status !== "active")
    return { ok: false, error: "notFound" };
  if (!canManage(mine.role) || group.visibility !== "private") {
    return { ok: false, error: "notAllowed" };
  }
  if (group._count.members >= MAX_PRIVATE_MEMBERS) {
    return { ok: false, error: "memberLimit" };
  }
  const blocked = await getBlockedIds(actorId);
  if (blocked.includes(targetId)) return { ok: false, error: "blocked" };
  const target = await db.profile.findFirst({
    where: {
      id: targetId,
      username: { not: null },
      settings: { communityRulesAt: { not: null } },
    },
    select: { id: true },
  });
  if (!target) return { ok: false, error: "notFound" };
  if (await membership(groupId, targetId)) {
    return { ok: false, error: "alreadyMember" };
  }
  const recent = await db.groupMember.count({
    where: {
      invitedById: actorId,
      createdAt: { gte: new Date(Date.now() - DAY_MS) },
    },
  });
  if (recent >= DAILY_GROUP_INVITES) return { ok: false, error: "inviteLimit" };
  await db.groupMember.create({
    data: {
      groupId,
      userId: targetId,
      status: "invited",
      invitedById: actorId,
    },
  });
  return { ok: true };
}

/** Accepter (rejoindre la discussion) ou refuser une invitation, sans prévenir personne. */
export async function respondToGroupInvite(
  userId: string,
  groupId: string,
  accept: boolean,
): Promise<Result<{ conversationId: string | null }>> {
  const mine = await membership(groupId, userId);
  if (mine?.status !== "invited") return { ok: false, error: "notFound" };
  if (!accept) {
    await db.groupMember.deleteMany({ where: { groupId, userId } });
    return { ok: true, conversationId: null };
  }
  const now = new Date();
  const conversation = await db.$transaction(async (tx) => {
    await tx.groupMember.update({
      where: { groupId_userId: { groupId, userId } },
      data: { status: "active", joinedAt: now },
    });
    const found = await tx.conversation.findUnique({
      where: { groupId },
      select: { id: true },
    });
    if (found) {
      await tx.conversationMember.upsert({
        where: { conversationId_userId: { conversationId: found.id, userId } },
        update: { clearedAt: null },
        create: {
          conversationId: found.id,
          userId,
          status: "accepted",
          lastReadAt: now,
        },
      });
    }
    return found;
  });
  await touch(groupId);
  return { ok: true, conversationId: conversation?.id ?? null };
}

/** Retire quelqu'un du groupe (ou annule son invitation). */
export async function removeGroupMember(
  actorId: string,
  groupId: string,
  targetId: string,
): Promise<Result> {
  const [mine, target] = await Promise.all([
    membership(groupId, actorId),
    membership(groupId, targetId),
  ]);
  if (mine?.status !== "active" || !target)
    return { ok: false, error: "notFound" };
  if (!canRemove(mine.role, target.role))
    return { ok: false, error: "notAllowed" };
  await removeMembership(groupId, targetId);
  return { ok: true };
}

/** Le créateur nomme ou retire un admin. */
export async function setGroupRole(
  ownerId: string,
  groupId: string,
  targetId: string,
  role: "admin" | "member",
): Promise<Result> {
  const [mine, target] = await Promise.all([
    membership(groupId, ownerId),
    membership(groupId, targetId),
  ]);
  if (mine?.role !== "owner") return { ok: false, error: "notAllowed" };
  if (target?.status !== "active" || target.role === "owner") {
    return { ok: false, error: "notFound" };
  }
  await db.groupMember.update({
    where: { groupId_userId: { groupId, userId: targetId } },
    data: { role },
  });
  return { ok: true };
}

/** Supprime le groupe (le créateur) : publications, discussion et leurs fichiers. */
export async function deleteGroup(
  ownerId: string,
  groupId: string,
): Promise<Result> {
  const mine = await membership(groupId, ownerId);
  if (mine?.role !== "owner") return { ok: false, error: "notAllowed" };
  const [postMedia, messageMedia] = await Promise.all([
    db.postMedia.findMany({
      where: { post: { groupId } },
      select: { path: true, posterPath: true },
    }),
    db.messageMedia.findMany({
      where: { message: { conversation: { groupId } } },
      select: { path: true, posterPath: true },
    }),
  ]);
  await db.group.delete({ where: { id: groupId } });
  const paths = [...postMedia, ...messageMedia].flatMap((row) => [
    row.path,
    ...(row.posterPath ? [row.posterPath] : []),
  ]);
  if (paths.length > 0) {
    await removeFiles(paths).catch((error: unknown) => {
      console.error("Fichiers d'un groupe non supprimés", error);
    });
  }
  return { ok: true };
}

/**
 * Membres du groupe (actifs, et invités pour le créateur et les admins), sans
 * les personnes bloquées dans un sens ou dans l'autre.
 */
export async function listGroupMembers(
  viewerId: string,
  groupId: string,
): Promise<GroupMemberItem[] | null> {
  const group = await getGroup(viewerId, groupId);
  if (!group) return null;
  const blocked = await getBlockedIds(viewerId);
  const rows = await db.groupMember.findMany({
    where: {
      groupId,
      ...(blocked.length > 0 ? { userId: { notIn: blocked } } : {}),
      ...(canManage(group.role) ? {} : { status: "active" as const }),
    },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    take: 200,
    select: { userId: true, role: true, status: true },
  });
  const byId = await persons(rows.map((row) => row.userId));
  return rows.flatMap((row) => {
    const person = byId.get(row.userId);
    return person ? [{ person, role: row.role, status: row.status }] : [];
  });
}

/** Une publication du forum d'un groupe : retirée par le créateur ou un admin. */
export async function removeGroupPost(
  actorId: string,
  postId: string,
): Promise<Result> {
  const post = await db.post.findUnique({
    where: { id: postId },
    select: { groupId: true },
  });
  if (!post?.groupId) return { ok: false, error: "notFound" };
  const mine = await membership(post.groupId, actorId);
  if (mine?.status !== "active" || !canManage(mine.role)) {
    return { ok: false, error: "notAllowed" };
  }
  await db.post.update({ where: { id: postId }, data: { status: "removed" } });
  return { ok: true };
}

/** Vrai si la personne est membre actif du groupe (publier, commenter, réagir). */
export async function isActiveMember(groupId: string, userId: string) {
  const mine = await membership(groupId, userId);
  return mine?.status === "active";
}
