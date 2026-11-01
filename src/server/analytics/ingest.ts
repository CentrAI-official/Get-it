import "server-only";
import {
  toEventRow,
  type AnalyticsClientEvent,
} from "@/features/analytics/events";
import {
  RATE_LIMIT,
  RATE_WINDOW_MS,
  RETENTION_DAYS,
} from "@/features/analytics/rules";
import { db } from "@/server/db";
import { getServerEnv } from "@/server/env";

/**
 * Enregistre un lot d'événements validés pour la personne connectée (jamais un
 * id reçu du navigateur). Au-delà de la limite de débit, le reste est ignoré.
 * Renvoie le nombre d'événements gardés.
 */
export async function ingestEvents(
  userId: string,
  events: readonly AnalyticsClientEvent[],
  now = new Date(),
) {
  const recent = await db.analyticsEvent.count({
    where: {
      userId,
      createdAt: { gte: new Date(now.getTime() - RATE_WINDOW_MS) },
    },
  });
  const kept = events.slice(0, Math.max(0, RATE_LIMIT - recent));
  if (kept.length === 0) return 0;

  const env = getServerEnv().VERCEL_ENV;
  await db.analyticsEvent.createMany({
    data: kept.map((event) => {
      const row = toEventRow(event, now);
      return {
        userId,
        env,
        name: row.name,
        sessionId: row.sessionId,
        section: row.section,
        route: row.route,
        target: row.target,
        durationMs: row.durationMs,
        occurredAt: row.occurredAt,
      };
    }),
  });
  return kept.length;
}

/** Au plus une purge toutes les 6 heures par instance du serveur. */
const PURGE_EVERY_MS = 6 * 60 * 60_000;
let lastPurgeAt = 0;

/** Efface les événements de plus de 13 mois (Loi 25 : pas plus longtemps que nécessaire). */
export async function purgeOldEvents(now = new Date()) {
  if (now.getTime() - lastPurgeAt < PURGE_EVERY_MS) return;
  lastPurgeAt = now.getTime();
  await db.analyticsEvent.deleteMany({
    where: {
      occurredAt: {
        lt: new Date(now.getTime() - RETENTION_DAYS * 86_400_000),
      },
    },
  });
}
