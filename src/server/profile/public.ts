import "server-only";
import { PILLARS, type Pillar } from "@/config/pillars";
import type { ContactState } from "@/features/contacts/rules";
import { levelFromXp } from "@/features/xp/rules";
import { getBlockedIds } from "@/server/community/members";
import { getContactState } from "@/server/contacts/service";
import { db } from "@/server/db";
import { getXpTotals } from "@/server/xp/service";
import { avatarUrl } from "./avatar";

// Profil vu par les autres membres du Centre : l'aperçu public et les
// publications. Jamais les objectifs, habitudes, check-ins ni l'autoévaluation.

export type PublicProfile = {
  id: string;
  displayName: string | null;
  username: string;
  bio: string | null;
  avatarUrl: string | null;
  level: number;
  pillarLevels: Record<Pillar, number>;
  focusPillars: Pillar[];
  /** Nombre de contacts (la liste reste privée). */
  contacts: number;
  /** « AAAA-MM-JJTHH:MM:SS.sssZ » */
  memberSince: string;
  /** La personne connectée regarde son propre profil. */
  mine: boolean;
  contactState: ContactState;
};

/** Nombre de contacts acceptés d'une personne. */
export async function countContacts(userId: string) {
  return db.contact.count({
    where: {
      status: "accepted",
      OR: [{ requesterId: userId }, { addresseeId: userId }],
    },
  });
}

/**
 * Profil public d'un membre du Centre, par son nom d'utilisateur. Null s'il
 * n'existe pas, n'a pas rejoint le Centre, ou si l'un a bloqué l'autre.
 */
export async function getPublicProfile(
  viewerId: string,
  username: string,
): Promise<PublicProfile | null> {
  const profile = await db.profile.findUnique({
    where: { username: username.toLowerCase() },
    select: {
      id: true,
      displayName: true,
      username: true,
      bio: true,
      avatarPath: true,
      focusPillars: true,
      createdAt: true,
      settings: { select: { communityRulesAt: true } },
    },
  });
  if (!profile?.username || !profile.settings?.communityRulesAt) return null;
  const mine = profile.id === viewerId;
  if (!mine && (await getBlockedIds(viewerId)).includes(profile.id))
    return null;

  const [xp, contacts, photo, contactState] = await Promise.all([
    getXpTotals(profile.id),
    countContacts(profile.id),
    avatarUrl(profile.avatarPath),
    mine ? ("none" as const) : getContactState(viewerId, profile.id),
  ]);
  return {
    id: profile.id,
    displayName: profile.displayName,
    username: profile.username,
    bio: profile.bio,
    avatarUrl: photo,
    level: levelFromXp(xp.total).level,
    pillarLevels: Object.fromEntries(
      PILLARS.map((pillar) => [pillar, levelFromXp(xp.pillars[pillar]).level]),
    ) as Record<Pillar, number>,
    focusPillars: profile.focusPillars,
    contacts,
    memberSince: profile.createdAt.toISOString(),
    mine,
    contactState,
  };
}
