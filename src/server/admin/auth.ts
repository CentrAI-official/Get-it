import "server-only";
import { io } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import {
  ADMIN_PATH,
  ADMIN_SIGN_IN_PATH,
  ADMIN_VERIFY_PATH,
} from "@/features/admin/surface";
import { db } from "@/server/db";
import { getServerEnv } from "@/server/env";
import { createSupabaseServerClient } from "@/server/supabase/server";

// Accès à l'application admin : un membre de l'équipe (rôle « admin », relu en
// base à chaque requête) connecté avec la double authentification (code d'une
// application d'authentification, niveau « aal2 » de Supabase). Chaque page,
// chaque Server Action et chaque lecture de données le revérifient.

export type AdminUser = { id: string; email: string | null };

/** Vrai sur le déploiement de l'application admin (APP_SURFACE=admin). */
export function isAdminSurface() {
  return getServerEnv().APP_SURFACE === "admin";
}

type AdminSession = AdminUser & {
  /** Rôle « admin » en base. */
  isAdmin: boolean;
  /** Niveau d'authentification de la session : « aal2 » après le code. */
  aal: string;
};

/** Session sur l'application admin, lue une fois par requête ; null hors de l'application admin. */
const readAdminSession = cache(async (): Promise<AdminSession | null> => {
  if (!isAdminSurface()) return null;
  // Vérifier l'expiration du jeton lit l'heure : jamais pendant le prérendu
  await io();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  const profile = await db.profile.findUnique({
    where: { id: claims.sub },
    select: { role: true },
  });
  return {
    id: claims.sub,
    email: claims.email ?? null,
    isAdmin: profile?.role === "admin",
    aal: claims.aal,
  };
});

// Redirections sans préfixe de langue : le proxy (next-intl) ajoute la langue,
// qui n'est pas lisible dans les Server Actions (next/root-params indisponible).

/**
 * Exige un membre de l'équipe connecté avec la double authentification. Hors de
 * l'application admin : introuvable ; sans session : connexion ; sans code : code.
 */
export async function requireAdmin(): Promise<AdminUser> {
  if (!isAdminSurface()) notFound();
  const session = await readAdminSession();
  if (!session?.isAdmin) redirect(ADMIN_SIGN_IN_PATH);
  if (session.aal !== "aal2") redirect(ADMIN_VERIFY_PATH);
  return { id: session.id, email: session.email };
}

/**
 * Étape du code : un membre de l'équipe connecté avec son mot de passe, pas
 * encore avec le code. Déjà vérifié : direction le dashboard.
 */
export async function requireAdminPassword(): Promise<AdminUser> {
  if (!isAdminSurface()) notFound();
  const session = await readAdminSession();
  if (!session?.isAdmin) redirect(ADMIN_SIGN_IN_PATH);
  if (session.aal === "aal2") redirect(ADMIN_PATH);
  return { id: session.id, email: session.email };
}

/** Applications d'authentification déjà reliées (facteurs TOTP vérifiés). */
export async function verifiedTotpFactors() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw error;
  return data.totp;
}
