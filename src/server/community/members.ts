import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { directKey } from "@/features/messages/rules";
import { db } from "@/server/db";

// Chaque fonction reçoit l'userId de la session et filtre dessus.

export type CommunityMember = {
  username: string | null;
  displayName: string | null;
  role: "user" | "moderator" | "admin";
  /** Fin de la suspension, si elle est en cours. */
  suspendedUntil: Date | null;
  /** Nom d'utilisateur choisi et règles acceptées. */
  joined: boolean;
};

/** Situation de l'utilisateur dans le Centre Get iT. */
export async function getCommunityMember(
  userId: string,
): Promise<CommunityMember | null> {
  const profile = await db.profile.findUnique({
    where: { id: userId },
    select: {
      username: true,
      displayName: true,
      role: true,
      suspendedUntil: true,
      settings: { select: { communityRulesAt: true } },
    },
  });
  if (!profile) return null;
  const suspended =
    profile.suspendedUntil && profile.suspendedUntil > new Date()
      ? profile.suspendedUntil
      : null;
  return {
    username: profile.username,
    displayName: profile.displayName,
    role: profile.role,
    suspendedUntil: suspended,
    joined: Boolean(profile.username && profile.settings?.communityRulesAt),
  };
}

export const isModerator = (role: CommunityMember["role"]) =>
  role === "moderator" || role === "admin";

/**
 * Rejoint le Centre : nom d'utilisateur (unique) et règles acceptées.
 * Faux si le nom est déjà pris.
 */
export async function joinCommunity(userId: string, username: string) {
  try {
    await db.$transaction([
      db.profile.update({ where: { id: userId }, data: { username } }),
      db.userSettings.updateMany({
        where: { userId },
        data: { communityRulesAt: new Date() },
      }),
    ]);
    return true;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return false;
    }
    throw error;
  }
}

/**
 * Personnes que l'utilisateur ne doit pas voir : celles qu'il a bloquées et
 * celles qui l'ont bloqué (le blocage marche dans les deux sens).
 */
export async function getBlockedIds(userId: string) {
  const blocks = await db.userBlock.findMany({
    where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    select: { blockerId: true, blockedId: true },
  });
  return [
    ...new Set(
      blocks.map((block) =>
        block.blockerId === userId ? block.blockedId : block.blockerId,
      ),
    ),
  ];
}

/** Bloque une personne. Faux si c'est soi-même ou si elle n'existe pas. */
export async function blockUser(userId: string, blockedId: string) {
  if (userId === blockedId) return false;
  const exists = await db.profile.findUnique({
    where: { id: blockedId },
    select: { id: true },
  });
  if (!exists) return false;
  // Les pactes ouverts entre les deux personnes s'arrêtent
  await db.pact.updateMany({
    where: {
      status: { in: ["proposed", "active"] },
      conversation: { directKey: directKey(userId, blockedId) },
    },
    data: { status: "cancelled", endedById: userId },
  });
  await db.userBlock.upsert({
    where: { blockerId_blockedId: { blockerId: userId, blockedId } },
    update: {},
    create: { blockerId: userId, blockedId },
  });
  return true;
}

export async function unblockUser(userId: string, blockedId: string) {
  await db.userBlock.deleteMany({ where: { blockerId: userId, blockedId } });
}

/** Personnes bloquées par l'utilisateur (Réglages). */
export async function listBlockedUsers(userId: string) {
  const blocks = await db.userBlock.findMany({
    where: { blockerId: userId },
    orderBy: { createdAt: "desc" },
    select: {
      blocked: { select: { id: true, displayName: true, username: true } },
    },
  });
  return blocks.map((block) => block.blocked);
}
