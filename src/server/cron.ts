import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { getServerEnv } from "@/server/env";

/** Comparaison en temps constant (empreintes de même longueur). */
function sameSecret(given: string, expected: string) {
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(given), digest(expected));
}

/**
 * Une tâche planifiée de Vercel (`vercel.json`) : seule la tâche, avec
 * CRON_SECRET, peut l'appeler, et jamais sur l'application admin.
 */
export async function runCron(
  request: Request,
  task: () => Promise<unknown>,
): Promise<Response> {
  const env = getServerEnv();
  if (env.APP_SURFACE !== "app") return new Response(null, { status: 404 });
  // Sans secret configuré, la tâche est désactivée (jamais ouverte à tous)
  if (!env.CRON_SECRET) return new Response(null, { status: 503 });
  const header = request.headers.get("authorization") ?? "";
  if (!sameSecret(header, `Bearer ${env.CRON_SECRET}`)) {
    return new Response(null, { status: 401 });
  }
  return Response.json(await task());
}
