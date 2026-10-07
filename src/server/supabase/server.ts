import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getServerEnv } from "@/server/env";

/**
 * Client Supabase lié aux cookies de la requête en cours.
 * Utilisé uniquement pour l'authentification : les données passent par Prisma (src/server/db.ts).
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const env = getServerEnv();

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Un Server Component ne peut pas écrire de cookies : le proxy
            // (src/proxy.ts) se charge alors de rafraîchir la session.
          }
        },
      },
    },
  );
}
