import { after } from "next/server";
import { analyticsBatchSchema } from "@/features/analytics/events";
import { MAX_BATCH_BYTES } from "@/features/analytics/rules";
import { ingestEvents, purgeOldEvents } from "@/server/analytics/ingest";
import { getSessionUser } from "@/server/auth/session";
import { getServerEnv } from "@/server/env";

/**
 * Reçoit un lot d'événements de mesure d'audience (temps actif par section,
 * ouverture d'une fenêtre), envoyé par le navigateur avec sendBeacon ou fetch.
 * Utilisé par le web et la future app mobile.
 */
export async function POST(request: Request) {
  // L'application admin ne mesure rien
  if (getServerEnv().APP_SURFACE !== "app") {
    return new Response(null, { status: 404 });
  }
  // Un autre site ne peut pas envoyer d'événements au nom de la personne
  const site = request.headers.get("sec-fetch-site");
  if (site !== null && site !== "same-origin") {
    return new Response(null, { status: 403 });
  }
  const user = await getSessionUser();
  if (!user) return new Response(null, { status: 401 });

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BATCH_BYTES) return new Response(null, { status: 413 });
  const text = await request.text();
  if (text.length > MAX_BATCH_BYTES) return new Response(null, { status: 413 });

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return new Response(null, { status: 400 });
  }
  const parsed = analyticsBatchSchema.safeParse(body);
  if (!parsed.success) return new Response(null, { status: 400 });

  try {
    await ingestEvents(user.id, parsed.data.events);
  } catch (error) {
    // La mesure ne doit jamais gêner l'application
    console.error("Événements de mesure non enregistrés", error);
  }
  after(() => purgeOldEvents().catch(() => undefined));
  return new Response(null, { status: 204 });
}
