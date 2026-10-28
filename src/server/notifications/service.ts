import "server-only";
import { after } from "next/server";
import { getTranslations } from "next-intl/server";
import webpush from "web-push";
import { siteConfig } from "@/config/site";
import {
  NOTIFICATION_RETENTION_MS,
  NOTIFICATION_SUBJECT_MAX,
  NOTIFICATIONS_SHOWN,
  notificationText,
  type NotificationKind,
} from "@/features/notifications/rules";
import { getBlockedIds } from "@/server/community/members";
import { db } from "@/server/db";
import { getServerEnv } from "@/server/env";
import { avatarUrls } from "@/server/profile/avatar";

// Notifications : enregistrées pour la cloche, puis envoyées aux téléphones
// abonnés (web push) après la réponse. Jamais pour soi-même ni entre personnes
// bloquées. Une notification ne fait jamais échouer l'action qui la déclenche.

export type NotifyInput = {
  /** Destinataire. */
  userId: string;
  kind: NotificationKind;
  actorId: string;
  /** Chemin sans la langue (ex. « /messages/<id> »). */
  href: `/${string}`;
  subject?: string;
  /** Regroupe les notifications non lues (ex. « message:<conversationId> »). */
  groupKey?: string;
};

export async function notify(input: NotifyInput) {
  try {
    if (input.userId === input.actorId) return;
    const blocked = await getBlockedIds(input.userId);
    if (blocked.includes(input.actorId)) return;
    const subject = (input.subject ?? "").slice(0, NOTIFICATION_SUBJECT_MAX);
    const existing = input.groupKey
      ? await db.notification.findFirst({
          where: {
            userId: input.userId,
            groupKey: input.groupKey,
            readAt: null,
          },
          select: { id: true, count: true },
        })
      : null;
    const count = (existing?.count ?? 0) + 1;
    if (existing) {
      await db.notification.update({
        where: { id: existing.id },
        data: { count, actorId: input.actorId, subject, kind: input.kind },
      });
    } else {
      await db.notification.create({
        data: {
          userId: input.userId,
          kind: input.kind,
          actorId: input.actorId,
          href: input.href,
          subject,
          groupKey: input.groupKey ?? null,
        },
      });
    }
    // Sur le téléphone : après la réponse, sans la ralentir
    after(() =>
      sendPush({ ...input, subject, count }).catch((error: unknown) => {
        console.error("Notification sur le téléphone non envoyée", error);
      }),
    );
  } catch (error) {
    console.error("Notification non enregistrée", error);
  }
}

/** Clés VAPID configurées : les notifications sur le téléphone sont possibles. */
export function pushEnabled() {
  const env = getServerEnv();
  return Boolean(env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
}

async function sendPush(
  input: NotifyInput & { subject: string; count: number },
) {
  const env = getServerEnv();
  if (!env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return;
  const [subscriptions, settings, actor] = await Promise.all([
    db.pushSubscription.findMany({
      where: { userId: input.userId },
      select: { id: true, endpoint: true, p256dh: true, auth: true },
    }),
    db.userSettings.findUnique({
      where: { userId: input.userId },
      select: { locale: true },
    }),
    db.profile.findUnique({
      where: { id: input.actorId },
      select: { displayName: true, username: true },
    }),
  ]);
  if (subscriptions.length === 0) return;
  const locale = settings?.locale ?? "fr";
  const t = await getTranslations({ locale, namespace: "Notifications" });
  const text = notificationText(input.kind, {
    name: actor?.displayName ?? actor?.username ?? "Get iT",
    subject: input.subject,
    count: input.count,
  });
  const payload = JSON.stringify({
    title: siteConfig.name,
    body: t(`items.${text.key}`, text.values),
    url: `/${locale}${input.href}`,
    // Même étiquette : la notification précédente de la discussion est remplacée
    tag: input.groupKey ?? input.kind,
  });
  // Contact du service de notifications : l'adresse du site (https) en ligne
  webpush.setVapidDetails(
    siteConfig.url.startsWith("https://")
      ? siteConfig.url
      : "mailto:notifications@example.com",
    env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    env.VAPID_PRIVATE_KEY,
  );
  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          payload,
          { TTL: 24 * 60 * 60 },
        );
      } catch (error) {
        // Abonnement expiré ou retiré par le téléphone : on l'oublie
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await db.pushSubscription
            .delete({ where: { id: subscription.id } })
            .catch(() => undefined);
        } else throw error;
      }
    }),
  );
}

export type NotificationItem = {
  id: string;
  kind: NotificationKind;
  href: string;
  subject: string;
  count: number;
  read: boolean;
  at: string;
  actor: { name: string; avatarUrl: string | null } | null;
};

/** Mes notifications, les plus récentes d'abord (les vieilles lues sont effacées). */
export async function listNotifications(
  userId: string,
): Promise<NotificationItem[]> {
  await db.notification.deleteMany({
    where: {
      userId,
      readAt: { not: null },
      updatedAt: { lt: new Date(Date.now() - NOTIFICATION_RETENTION_MS) },
    },
  });
  const blocked = await getBlockedIds(userId);
  const rows = await db.notification.findMany({
    where: {
      userId,
      ...(blocked.length > 0 ? { actorId: { notIn: blocked } } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: NOTIFICATIONS_SHOWN,
    select: {
      id: true,
      kind: true,
      href: true,
      subject: true,
      count: true,
      readAt: true,
      updatedAt: true,
      actor: {
        select: { displayName: true, username: true, avatarPath: true },
      },
    },
  });
  const avatars = await avatarUrls(rows.map((row) => row.actor?.avatarPath));
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    href: row.href,
    subject: row.subject,
    count: row.count,
    read: row.readAt !== null,
    at: row.updatedAt.toISOString(),
    actor: row.actor
      ? {
          name: row.actor.displayName ?? row.actor.username ?? "",
          avatarUrl: row.actor.avatarPath
            ? (avatars.get(row.actor.avatarPath) ?? null)
            : null,
        }
      : null,
  }));
}

/** Page des notifications : la liste et l'heure du chargement (dates relatives). */
export async function getNotificationsPage(userId: string) {
  const items = await listNotifications(userId);
  return { items, loadedAt: Date.now() };
}

/** Notifications pas encore lues (pastille de la cloche). */
export async function countUnreadNotifications(userId: string) {
  const blocked = await getBlockedIds(userId);
  return db.notification.count({
    where: {
      userId,
      readAt: null,
      ...(blocked.length > 0 ? { actorId: { notIn: blocked } } : {}),
    },
  });
}

/** Tout est lu (la page des notifications est ouverte). */
export async function markNotificationsRead(userId: string) {
  await db.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
}

/** Enregistre l'abonnement web push de ce navigateur. */
export async function savePushSubscription(
  userId: string,
  subscription: { endpoint: string; p256dh: string; auth: string },
) {
  await db.pushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    update: { userId, p256dh: subscription.p256dh, auth: subscription.auth },
    create: { userId, ...subscription },
  });
}

/** Retire l'abonnement de ce navigateur. */
export async function removePushSubscription(userId: string, endpoint: string) {
  await db.pushSubscription.deleteMany({ where: { userId, endpoint } });
}
