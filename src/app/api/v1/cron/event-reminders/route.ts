import { createHash, timingSafeEqual } from "node:crypto";
import { getServerEnv } from "@/server/env";
import { sendEventReminders } from "@/server/community-events/service";

/** Comparaison en temps constant (empreintes de même longueur). */
function sameSecret(given: string, expected: string) {
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(given), digest(expected));
}

/**
 * Rappel des événements 24 h avant (tâche planifiée de Vercel, toutes les
 * heures, `vercel.json`). Seule la tâche, avec CRON_SECRET, peut l'appeler.
 */
export async function GET(request: Request) {
  const env = getServerEnv();
  if (env.APP_SURFACE !== "app") return new Response(null, { status: 404 });
  // Sans secret configuré, la tâche est désactivée (jamais ouverte à tous)
  if (!env.CRON_SECRET) return new Response(null, { status: 503 });
  const header = request.headers.get("authorization") ?? "";
  if (!sameSecret(header, `Bearer ${env.CRON_SECRET}`)) {
    return new Response(null, { status: 401 });
  }
  const result = await sendEventReminders();
  return Response.json(result);
}
