import { hasLocale } from "next-intl";
import { NextResponse, type NextRequest } from "next/server";
import { APP_HOME_PATH } from "@/features/auth/access";
import { safeNextPath } from "@/features/auth/redirect";
import { routing } from "@/i18n/routing";
import { completeEmailLink } from "@/server/auth/service";

/** Destination des liens envoyés par courriel : confirmation d'adresse et réinitialisation. */
export async function GET(
  request: NextRequest,
  { params }: RouteContext<"/[locale]/auth/confirm">,
) {
  const { locale: localeParam } = await params;
  const locale = hasLocale(routing.locales, localeParam)
    ? localeParam
    : routing.defaultLocale;
  const { searchParams } = request.nextUrl;

  const result = await completeEmailLink({
    tokenHash: searchParams.get("token_hash"),
    type: searchParams.get("type"),
    code: searchParams.get("code"),
    locale,
  });

  if (!result.ok) {
    const login = new URL(`/${locale}/login`, request.url);
    login.searchParams.set("error", result.error);
    return NextResponse.redirect(login);
  }

  // La langue enregistrée dans le compte l'emporte sur celle du lien
  const next = safeNextPath(searchParams.get("next")) ?? APP_HOME_PATH;
  return NextResponse.redirect(
    new URL(`/${result.data.locale}${next}`, request.url),
  );
}
