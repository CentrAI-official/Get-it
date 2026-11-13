"use server";

import { revalidatePath } from "next/cache";
import { hasLocale } from "next-intl";
import { isThemePreference } from "@/config/theme";
import type { ConfirmState } from "@/components/confirm-dialog";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { isValidTimeZone } from "@/lib/time-zone";
import { deleteAccount } from "@/server/account/service";
import { setPersonalization } from "@/server/analytics/personalization";
import { signOut } from "@/server/auth/service";
import { getSessionUser, requireUser } from "@/server/auth/session";
import { setShowPresence } from "@/server/presence/service";
import {
  updateLocale,
  updateTheme,
  updateTimeZone,
} from "@/server/profile/service";

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

/** « Personnaliser mon expérience » : accord pour l'analyse de mes intérêts (désactivé par défaut). */
export async function setPersonalizationAction(enabled: unknown) {
  if (typeof enabled !== "boolean") return false;
  const user = await requireUser();
  try {
    await setPersonalization(user.id, enabled);
    return true;
  } catch (error) {
    console.error("Réglage de personnalisation impossible", error);
    return false;
  }
}

/** « Montrer quand je suis en ligne » (réciproque : sinon je ne vois pas celle des autres). */
export async function setPresenceAction(show: unknown) {
  if (typeof show !== "boolean") return false;
  const user = await requireUser();
  try {
    await setShowPresence(user.id, show);
    return true;
  } catch (error) {
    console.error("Réglage de présence impossible", error);
    return false;
  }
}

/** Le fuseau du compte : tout ce qui se compte « par jour » suit la nouvelle heure. */
export async function saveTimeZoneAction(timeZone: unknown) {
  if (!isValidTimeZone(timeZone)) return false;
  const user = await requireUser();
  try {
    await updateTimeZone(user.id, timeZone);
  } catch (error) {
    console.error("Fuseau horaire non enregistré", error);
    return false;
  }
  // Les journées, les séries, le budget et le calendrier changent de jour
  revalidatePath("/", "layout");
  return true;
}
