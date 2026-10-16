import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";

/** Page d'arrivée d'un utilisateur connecté : la Communauté. */
export const APP_HOME_PATH = "/community";
/** Parcours de départ, à terminer avant d'utiliser l'application. */
export const ONBOARDING_PATH = "/onboarding";
export const RESET_PASSWORD_PATH = "/reset-password";

/** Pages de l'application, réservées aux utilisateurs connectés. */
export const PROTECTED_PATHS = [
  "/community",
  "/groups",
  "/events",
  "/messages",
  "/services",
  "/marketplace",
  "/profile",
  "/goals",
  "/habits",
  "/coach",
  "/moderation",
  "/settings",
  ONBOARDING_PATH,
] as const;

/** Où mener un utilisateur qui vient d'ouvrir sa session. */
export function getPostLoginPath(
  onboarded: boolean,
  next: string | null,
): string {
  // Changer de mot de passe passe avant tout ; sinon, l'onboarding avant l'application
  if (next === RESET_PASSWORD_PATH) return next;
  if (!onboarded) return ONBOARDING_PATH;
  return next ?? APP_HOME_PATH;
}

/** Pages destinées aux visiteurs : un utilisateur connecté va directement dans l'application. */
const GUEST_PATHS = ["/", "/login", "/signup", "/forgot-password"] as const;

function matchesPath(path: string, base: string) {
  return base === "/"
    ? path === "/"
    : path === base || path.startsWith(`${base}/`);
}

type AuthRedirectInput = {
  /** Chemin demandé, préfixé par la langue (ex. « /fr/goals »). */
  pathname: string;
  search: string;
  isAuthenticated: boolean;
};

/**
 * Vérification rapide faite par le proxy : où rediriger selon la session, ou null.
 * Ce n'est pas une autorisation : chaque accès aux données revérifie la session.
 */
export function getAuthRedirect({
  pathname,
  search,
  isAuthenticated,
}: AuthRedirectInput): string | null {
  const [, locale, ...rest] = pathname.split("/");
  if (!hasLocale(routing.locales, locale)) return null;
  const path = `/${rest.join("/")}`;

  if (isAuthenticated) {
    return GUEST_PATHS.some((base) => matchesPath(path, base))
      ? `/${locale}${APP_HOME_PATH}`
      : null;
  }

  // Sans session, le lien de réinitialisation a expiré : on en redemande un
  if (matchesPath(path, RESET_PASSWORD_PATH)) {
    return `/${locale}/forgot-password`;
  }
  if (PROTECTED_PATHS.some((base) => matchesPath(path, base))) {
    const next = encodeURIComponent(`${path}${search}`);
    return `/${locale}/login?next=${next}`;
  }
  return null;
}
