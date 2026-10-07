"use server";

import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { getSessionUser } from "@/server/auth/session";
import { updateLocale } from "@/server/profile/service";

/** Enregistre la langue choisie dans le compte. Sans session, ne fait rien : le cookie suffit. */
export async function saveLocalePreferenceAction(locale: unknown) {
  if (!hasLocale(routing.locales, locale)) return;
  const user = await getSessionUser();
  if (user) await updateLocale(user.id, locale);
}
