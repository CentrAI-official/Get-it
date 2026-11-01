import { clientErrorSchema } from "@/features/analytics/errors";
import { getSessionUser } from "@/server/auth/session";
import { getServerEnv } from "@/server/env";
import { recordClientError } from "@/server/errors/service";

/** Taille maximale d'une erreur reçue, en octets. */
const MAX_BYTES = 4_000;

/**
 * Reçoit une erreur rencontrée par le navigateur d'une personne connectée, pour
 * le dashboard de l'équipe. Le message est nettoyé avant d'être enregistré.
 */
export async function POST(request: Request) {
  if (getServerEnv().APP_SURFACE !== "app") {
    return new Response(null, { status: 404 });
  }
  const site = request.headers.get("sec-fetch-site");
  if (site !== null && site !== "same-origin") {
    return new Response(null, { status: 403 });
  }
  const user = await getSessionUser();
  if (!user) return new Response(null, { status: 401 });

  const text = await request.text();
  if (text.length > MAX_BYTES) return new Response(null, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return new Response(null, { status: 400 });
  }
  const parsed = clientErrorSchema.safeParse(body);
  if (!parsed.success) return new Response(null, { status: 400 });

  await recordClientError(user.id, parsed.data);
  return new Response(null, { status: 204 });
}
