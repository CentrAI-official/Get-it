import { hasLocale } from "next-intl";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { signOut } from "@/server/auth/service";

/**
 * Ferme une session devenue invalide (ex. compte supprimé depuis un autre appareil)
 * et renvoie vers la connexion. Les déconnexions volontaires passent par signOutAction.
 */
export async function GET(
  request: NextRequest,
  { params }: RouteContext<"/[locale]/auth/sign-out">,
) {
  const { locale } = await params;
  await signOut().catch(() => undefined);
  const target = hasLocale(routing.locales, locale)
    ? locale
    : routing.defaultLocale;
  return NextResponse.redirect(new URL(`/${target}/login`, request.url));
}
