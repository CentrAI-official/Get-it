"use server";

import { hasLocale } from "next-intl";
import { isThemePreference } from "@/config/theme";
import type { ConfirmState } from "@/components/confirm-dialog";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { deleteAccount } from "@/server/account/service";
import { signOut } from "@/server/auth/service";
import { getSessionUser, requireUser } from "@/server/auth/session";
import { updateLocale, updateTheme } from "@/server/profile/service";

/** Enregistre la langue choisie dans le compte. Sans session, ne fait rien : le cookie suffit. */
export async function saveLocalePreferenceAction(locale: unknown) {
  if (!hasLocale(routing.locales, locale)) return;
  const user = await getSessionUser();
  if (user) await updateLocale(user.id, locale);
}

/** Enregistre le thème choisi dans le compte (le cookie l'applique déjà dans ce navigateur). */
export async function saveThemePreferenceAction(theme: unknown) {
  if (!isThemePreference(theme)) return;
  const user = await requireUser();
  await updateTheme(user.id, theme);
}

/** Supprime définitivement le compte connecté, ferme la session et renvoie vers la connexion. */
export async function deleteAccountAction(
  _previous: ConfirmState,
  formData: FormData,
): Promise<ConfirmState> {
  const user = await requireUser();
  const value = formData.get("locale");
  const locale = hasLocale(routing.locales, value)
    ? value
    : routing.defaultLocale;

  try {
    await deleteAccount(user.id);
  } catch (error) {
    console.error("Suppression du compte impossible", error);
    return { status: "error" };
  }

  // Le compte n'existe plus : seule la suppression des cookies de session compte ici
  await signOut().catch(() => undefined);
  return redirect({
    href: { pathname: "/login", query: { accountDeleted: "1" } },
    locale,
  });
}
