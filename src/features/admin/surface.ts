import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";

// L'application admin est un déploiement à part du même code (APP_SURFACE=admin),
// sur sa propre adresse protégée par Vercel Authentication. Elle ne sert que
// /admin ; l'application des membres, elle, répond « introuvable » sous /admin.

export const APP_SURFACES = ["app", "admin"] as const;
export type AppSurface = (typeof APP_SURFACES)[number];

export const ADMIN_PATH = "/admin";
export const ADMIN_SIGN_IN_PATH = "/admin/sign-in";
/** Code de l'application d'authentification, à chaque connexion. */
export const ADMIN_VERIFY_PATH = "/admin/verify";
/** Première connexion : relier une application d'authentification. */
export const ADMIN_ENROLL_PATH = "/admin/enroll";

/** Vrai pour /admin et ses sous-pages (chemin sans la langue). */
export function isAdminPath(path: string) {
  return path === ADMIN_PATH || path.startsWith(`${ADMIN_PATH}/`);
}

/**
 * Sur l'application admin, toute page hors de /admin mène au dashboard.
 * Renvoie la destination, ou null s'il n'y a rien à faire.
 */
export function adminSurfaceRedirect(pathname: string): string | null {
  const [, locale, ...rest] = pathname.split("/");
  if (!hasLocale(routing.locales, locale)) return null;
  return isAdminPath(`/${rest.join("/")}`) ? null : `/${locale}${ADMIN_PATH}`;
}
