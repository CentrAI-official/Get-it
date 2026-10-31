import "server-only";
import { isOnline, PRESENCE_TOUCH_MS } from "@/features/presence/rules";
import { getBlockedIds } from "@/server/community/members";
import { contactIds } from "@/server/contacts/service";
import { db } from "@/server/db";

// Présence en ligne : la dernière activité de chacun, montrée à ses contacts
// seulement (personnes bloquées exclues), si les deux la montrent.

/** L'application est ouverte : la dernière activité avance (au plus une fois par minute). */
export async function touchPresence(userId: string) {
  const now = new Date();
  await db.profile.updateMany({
    where: {
      id: userId,
      OR: [
        { lastSeenAt: null },
        { lastSeenAt: { lt: new Date(now.getTime() - PRESENCE_TOUCH_MS) } },
      ],
    },
    data: { lastSeenAt: now },
  });
}

/** Je montre ma présence ? (sinon je ne vois pas non plus celle des autres) */
export async function showsPresence(userId: string) {
  const settings = await db.userSettings.findUnique({
    where: { userId },
    select: { showPresence: true },
  });
  return settings?.showPresence ?? true;
}

export async function setShowPresence(userId: string, show: boolean) {
  await db.userSettings.updateMany({
    where: { userId },
    data: { showPresence: show },
  });
}

/** Mes contacts en ligne en ce moment (vide si je cache ma présence). */
export async function onlineContactIds(viewerId: string): Promise<Set<string>> {
  const [shows, contacts, blocked] = await Promise.all([
    showsPresence(viewerId),
    contactIds(viewerId),
    getBlockedIds(viewerId),
  ]);
  const candidates = [...contacts].filter((id) => !blocked.includes(id));
  if (!shows || candidates.length === 0) return new Set();
  const people = await db.profile.findMany({
    where: { id: { in: candidates }, lastSeenAt: { not: null } },
    select: {
      id: true,
      lastSeenAt: true,
      settings: { select: { showPresence: true } },
    },
  });
  const now = new Date();
  return new Set(
    people
      .filter((person) =>
        isOnline(
          {
            lastSeenAt: person.lastSeenAt,
            showPresence: person.settings?.showPresence ?? true,
          },
          true,
          now,
        ),
      )
      .map((person) => person.id),
  );
}
