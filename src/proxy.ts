import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Détecte la langue (cookie, puis navigateur) et redirige vers /fr ou /en
export default createMiddleware(routing);

export const config = {
  // Toutes les pages, sauf l'API, les fichiers internes de Next.js et les fichiers statiques
  matcher: "/((?!api|trpc|_next|_vercel|.*\\..*).*)",
};
