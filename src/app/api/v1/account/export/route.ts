import { exportAccount } from "@/server/account/export";
import { getSessionUser } from "@/server/auth/session";
import { getServerEnv } from "@/server/env";

/** Un téléchargement à la fois par personne, au plus toutes les 30 secondes. */
const recent = new Map<string, number>();

/**
 * « Télécharger mes données » (Loi 25, droit à la portabilité) : tout ce que Get iT
 * garde sur la personne connectée, en un fichier JSON. Jamais les données d'un autre.
 */
export async function GET(request: Request) {
  if (getServerEnv().APP_SURFACE !== "app") {
    return new Response(null, { status: 404 });
  }
  const site = request.headers.get("sec-fetch-site");
  if (site !== null && site !== "same-origin" && site !== "none") {
    return new Response(null, { status: 403 });
  }
  const user = await getSessionUser();
  if (!user) return new Response(null, { status: 401 });
  const now = Date.now();
  if (now - (recent.get(user.id) ?? 0) < 30_000) {
    return new Response(null, { status: 429 });
  }
  recent.set(user.id, now);
  if (recent.size > 5000) recent.clear();

  const body = await exportAccount(user.id);
  const day = new Date(now).toISOString().slice(0, 10);
  return new Response(body, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="get-it-mes-donnees-${day}.json"`,
      "cache-control": "no-store",
    },
  });
}
