import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { getAuthRedirect } from "./features/auth/access";
import { routing } from "./i18n/routing";
import { refreshSession } from "./server/supabase/proxy";

// Détecte la langue (cookie, puis navigateur) et redirige vers /fr ou /en
const handleI18nRouting = createMiddleware(routing);

export default async function proxy(request: NextRequest) {
  const response = handleI18nRouting(request);

  // Rafraîchit la session : les nouveaux cookies partent avec la réponse de next-intl
  const userId = await refreshSession(request, response);

  const target = getAuthRedirect({
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
    isAuthenticated: userId !== null,
  });
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

export const config = {
  // Toutes les pages, sauf l'API, les fichiers internes de Next.js et les fichiers statiques
  matcher: "/((?!api|trpc|_next|_vercel|.*\\..*).*)",
};
