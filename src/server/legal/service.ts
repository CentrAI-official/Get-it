import "server-only";
import { db } from "@/server/db";
import { getServerEnv } from "@/server/env";

/**
 * La personne responsable de la protection des renseignements personnels (Loi 25),
 * ou null tant qu'elle n'est pas configurée : les pages Confidentialité et
 * Conditions, la case de l'inscription et l'écran d'acceptation restent éteints.
 */
export function privacyOfficer(): { name: string; email: string } | null {
  const env = getServerEnv();
  return env.PRIVACY_OFFICER_NAME && env.PRIVACY_OFFICER_EMAIL
    ? { name: env.PRIVACY_OFFICER_NAME, email: env.PRIVACY_OFFICER_EMAIL }
    : null;
}

/** Les conditions et la politique sont en ligne : il faut les accepter. */
export function legalReady() {
  return privacyOfficer() !== null;
}

/** Les conditions et la politique acceptées (écran unique des membres d'avant). */
export async function acceptTerms(userId: string) {
  await db.userSettings.updateMany({
    where: { userId, termsAcceptedAt: null },
    data: { termsAcceptedAt: new Date() },
  });
}
