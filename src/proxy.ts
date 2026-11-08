import { hasLocale } from "next-intl";
import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { adminSurfaceRedirect } from "./features/admin/surface";
import { IDENTITY_COOKIE, identityFromCookie } from "./config/identity";
import { getAuthRedirect } from "./features/auth/access";
import { identityRedirect } from "./features/identity/routes";
import { routing } from "./i18n/routing";
import { getServerEnv } from "./server/env";
import { refreshSession } from "./server/supabase/proxy";

// Détecte la langue (cookie, puis navigateur) et redirige vers /fr ou /en
const handleI18nRouting = createMiddleware(routing);

export default async function proxy(request: NextRequest) {
  const response = handleI18nRouting(request);

  // Rafraîchit la session : les nouveaux cookies partent avec la réponse de next-intl
  const userId = await refreshSession(request, response);

  // Application admin : seul /admin existe, et ses pages vérifient elles-mêmes
  // la session, le rôle et la double authentification
  const admin = getServerEnv().APP_SURFACE === "admin";
  const target =
    (admin
      ? adminSurfaceRedirect(request.nextUrl.pathname)
      : getAuthRedirect({
          pathname: request.nextUrl.pathname,
          search: request.nextUrl.search,
          isAuthenticated: userId !== null,
        })) ?? (admin || !userId ? null : identityTarget(request));
  if (!target) return response;

  // Redirection selon la session, en conservant les cookies et en-têtes déjà posés
  const redirect = NextResponse.redirect(new URL(target, request.url));
  for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
  for (const header of ["cache-control", "expires", "pragma"]) {
    const value = response.headers.get(header);
    if (value) redirect.headers.set(header, value);
  }
  return redirect;
}

/**
 * Compte actif (mode page) : une section qui n'existe que pour l'autre compte
 * mène à son équivalent (ex. Mon développement → Clients sur sa page).
 */
function identityTarget(request: NextRequest) {
  const [, locale, ...rest] = request.nextUrl.pathname.split("/");
  if (!hasLocale(routing.locales, locale)) return null;
  const identity = identityFromCookie(
    request.cookies.get(IDENTITY_COOKIE)?.value,
  );
  const to = identityRedirect(`/${rest.join("/")}`, identity);
  return to ? `/${locale}${to}` : null;
}

export const config = {
  // Toutes les pages, sauf l'API, les fichiers internes de Next.js et les fichiers statiques
  matcher: "/((?!api|trpc|_next|_vercel|.*\\..*).*)",
};
