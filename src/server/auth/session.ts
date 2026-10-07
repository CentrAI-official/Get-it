import "server-only";
import { io } from "next/cache";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createSupabaseServerClient } from "@/server/supabase/server";

export type SessionUser = {
  id: string;
  email: string | null;
};

/** Utilisateur connecté, vérifié à partir du jeton de session, ou null. Lu une fois par requête. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  // Vérifier l'expiration du jeton lit l'heure (Date.now) : jamais pendant le prérendu
  await io();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { id: claims.sub, email: claims.email ?? null };
});

/**
 * Exige une session. À appeler au plus près des données (services, Server Actions) :
 * le proxy ne fait qu'une vérification rapide.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    // Sans préfixe de langue : le proxy (next-intl) ajoute la langue de l'utilisateur.
    // La langue n'est pas lisible ici, car next/root-params est indisponible dans les Server Actions.
    redirect("/login");
  }
  return user;
}
