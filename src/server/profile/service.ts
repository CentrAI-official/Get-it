import "server-only";
import { hasLocale, type Locale } from "next-intl";
import { routing } from "@/i18n/routing";
import { isValidTimeZone } from "@/lib/time-zone";
import { db } from "@/server/db";

type ProfilePreferences = {
  /** Langue de l'interface au moment de l'inscription. */
  locale?: unknown;
  /** Fuseau du navigateur, transmis à l'inscription. */
  timeZone?: unknown;
};

/**
 * Crée le profil et les réglages d'un utilisateur s'ils n'existent pas encore.
 * Appelé à chaque ouverture de session : idempotent. Renvoie la langue enregistrée.
 * Les préférences viennent du navigateur : elles sont vérifiées, sinon ignorées.
 */
export async function ensureProfile(
  userId: string,
  preferences: ProfilePreferences = {},
): Promise<{ locale: Locale }> {
  const locale = hasLocale(routing.locales, preferences.locale)
    ? preferences.locale
    : routing.defaultLocale;
  const timeZone = isValidTimeZone(preferences.timeZone)
    ? preferences.timeZone
    : undefined;

  const profile = await db.profile.upsert({
    where: { id: userId },
    update: {},
    create: { id: userId, settings: { create: { locale, timeZone } } },
    select: { settings: { select: { locale: true } } },
  });

  return { locale: profile.settings?.locale ?? locale };
}

/** Enregistre la langue choisie, pour qu'elle suive l'utilisateur sur tous ses appareils. */
export async function updateLocale(userId: string, locale: Locale) {
  await db.userSettings.updateMany({ where: { userId }, data: { locale } });
}
