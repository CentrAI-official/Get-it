"use server";

import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import { getActingPage } from "@/server/pages/identity";
import {
  countUnreadNotifications,
  markNotificationsRead,
  removePushSubscription,
  savePushSubscription,
} from "@/server/notifications/service";

/** Pastille de la cloche (celle du compte actif : le sien, ou sa page). */
export async function countUnreadNotificationsAction(): Promise<number> {
  const user = await requireUser();
  const page = await getActingPage(user.id);
  return countUnreadNotifications(user.id, page?.id ?? null).catch(() => 0);
}

/** La page des notifications est ouverte : tout est lu (pour le compte actif). */
export async function markNotificationsReadAction() {
  const user = await requireUser();
  const page = await getActingPage(user.id);
  await markNotificationsRead(user.id, page?.id ?? null);
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
