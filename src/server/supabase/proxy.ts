import "server-only";
import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";
import { getServerEnv } from "@/server/env";

/**
 * Rafraîchit la session Supabase pendant le proxy et écrit les nouveaux cookies
 * sur `response` (Next.js les transmet aussi aux pages de la même requête).
 * Renvoie l'id de l'utilisateur connecté, ou null.
 */
export async function refreshSession(
  request: NextRequest,
  response: NextResponse,
): Promise<string | null> {
  const env = getServerEnv();
  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet, headers) {
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
          // Empêche un cache intermédiaire de servir la session d'un utilisateur à un autre
          for (const [key, value] of Object.entries(headers)) {
            response.headers.set(key, value);
          }
        },
      },
    },
  );

  // getClaims vérifie la signature du jeton ; getSession ne le ferait pas
  const { data } = await supabase.auth.getClaims();
  return data?.claims.sub ?? null;
}
