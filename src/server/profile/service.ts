import "server-only";
import { hasLocale, type Locale } from "next-intl";
import { getLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { Pillar } from "@/config/pillars";
import type { AccountType } from "@/features/marketplace/rules";
import type { Occupation } from "@/features/onboarding/schemas";
import type { UserRole } from "@/generated/prisma/client";
import { routing } from "@/i18n/routing";
import { isValidTimeZone } from "@/lib/time-zone";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";

type ProfilePreferences = {
  /** Langue de l'interface au moment de l'inscription. */
  locale?: unknown;
  /** Fuseau du navigateur, transmis à l'inscription. */
  timeZone?: unknown;
};

/**
 * Crée le profil et les réglages d'un utilisateur s'ils n'existent pas encore.
 * Appelé à chaque ouverture de session : idempotent. Renvoie la langue enregistrée
 * et indique si l'onboarding est terminé.
 * Les préférences viennent du navigateur : elles sont vérifiées, sinon ignorées.
 */
export async function ensureProfile(
  userId: string,
  preferences: ProfilePreferences = {},
): Promise<{ locale: Locale; onboarded: boolean }> {
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
    select: { onboardedAt: true, settings: { select: { locale: true } } },
  });

  return {
    locale: profile.settings?.locale ?? locale,
    onboarded: profile.onboardedAt !== null,
  };
}

/** Vrai si le profil Get iT de ce compte existe déjà. */
export async function hasProfile(userId: string) {
  const profile = await db.profile.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  return profile !== null;
}

/** Enregistre la langue choisie, pour qu'elle suive l'utilisateur sur tous ses appareils. */
export async function updateLocale(userId: string, locale: Locale) {
  await db.userSettings.updateMany({ where: { userId }, data: { locale } });
}

/** Fuseau de l'utilisateur (Server Actions : getCurrentProfile y est indisponible). */
export async function getUserTimeZone(userId: string) {
  const settings = await db.userSettings.findUnique({
    where: { userId },
    select: { timeZone: true },
  });
  return settings?.timeZone ?? "America/Toronto";
}

export type CurrentProfile = {
  id: string;
  email: string | null;
  displayName: string | null;
  occupation: Occupation | null;
  focusPillars: Pillar[];
  onboardedAt: Date | null;
  createdAt: Date;
  timeZone: string;
  dailyMinutes: number | null;
  /** Consommateur, ou affilié (peut vendre dans le Marketplace). */
  accountType: AccountType;
  role: UserRole;
  /** Courte présentation et chemin de la photo (lien : `avatarUrl`). */
  bio: string | null;
  avatarPath: string | null;
};

/**
 * Profil de l'utilisateur connecté (Server Components). Lu une fois par requête.
 * Si le compte n'existe plus alors que le jeton est encore valide (compte supprimé
 * depuis un autre appareil), la session est fermée.
 */
export const getCurrentProfile = cache(async (): Promise<CurrentProfile> => {
  const user = await requireUser();
  const profile = await db.profile.findUnique({
    where: { id: user.id },
    select: {
      displayName: true,
      occupation: true,
      focusPillars: true,
      onboardedAt: true,
      createdAt: true,
      accountType: true,
      role: true,
      bio: true,
      avatarPath: true,
      settings: { select: { timeZone: true, dailyMinutes: true } },
    },
  });

  if (!profile) {
    redirect(`/${await getLocale()}/auth/sign-out`);
  }

  return {
    id: user.id,
    email: user.email,
    displayName: profile.displayName,
    occupation: profile.occupation,
    focusPillars: profile.focusPillars,
    onboardedAt: profile.onboardedAt,
    createdAt: profile.createdAt,
    timeZone: profile.settings?.timeZone ?? "America/Toronto",
    dailyMinutes: profile.settings?.dailyMinutes ?? null,
    accountType: profile.accountType,
    role: profile.role,
    bio: profile.bio,
    avatarPath: profile.avatarPath,
  };
});

/** Dernière autoévaluation de chaque pilier. `userId` vient toujours de la session. */
export async function getLatestAssessments(userId: string) {
  return db.pillarAssessment.findMany({
    where: { userId },
    orderBy: [{ pillar: "asc" }, { createdAt: "desc" }],
    distinct: ["pillar"],
    select: { pillar: true, score: true },
  });
}
