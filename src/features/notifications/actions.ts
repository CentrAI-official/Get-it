"use server";

import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import {
  countUnreadNotifications,
  markNotificationsRead,
  removePushSubscription,
  savePushSubscription,
} from "@/server/notifications/service";

/** Pastille de la cloche. */
export async function countUnreadNotificationsAction(): Promise<number> {
  const user = await requireUser();
  return countUnreadNotifications(user.id).catch(() => 0);
}

/** La page des notifications est ouverte : tout est lu. */
export async function markNotificationsReadAction() {
  const user = await requireUser();
  await markNotificationsRead(user.id);
}

// Abonnement web push envoyé par le navigateur (PushSubscription.toJSON())
const subscriptionSchema = z.object({
  endpoint: z.url({ protocol: /^https$/ }).max(1000),
  keys: z.object({
    p256dh: z.string().min(1).max(200),
    auth: z.string().min(1).max(100),
  }),
});

/** Active les notifications sur ce téléphone (ou cet ordinateur). */
export async function savePushSubscriptionAction(
  subscription: unknown,
): Promise<boolean> {
  const user = await requireUser();
  const parsed = subscriptionSchema.safeParse(subscription);
  if (!parsed.success) return false;
  try {
    await savePushSubscription(user.id, {
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
    });
    return true;
  } catch (error) {
    console.error("Abonnement aux notifications impossible", error);
    return false;
  }
}

/** Désactive les notifications sur ce navigateur. */
export async function removePushSubscriptionAction(endpoint: unknown) {
  const user = await requireUser();
  const parsed = z.url().max(1000).safeParse(endpoint);
  if (!parsed.success) return;
  await removePushSubscription(user.id, parsed.data);
}
