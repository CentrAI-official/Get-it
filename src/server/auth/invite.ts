import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { normalizeInviteCode } from "@/features/auth/invite";
import { getServerEnv } from "@/server/env";

// Bêta privée : avec SIGNUP_INVITE_CODE, seules les personnes qui ont le code
// créent un compte. Le code est vérifié à l'inscription, puis de nouveau à la
// création du profil (un compte créé en contournant le formulaire n'entre pas).

/** Vrai si l'inscription demande un code d'invitation. */
export function inviteRequired() {
  return Boolean(getServerEnv().SIGNUP_INVITE_CODE);
}

const digest = (value: unknown) =>
  createHash("sha256").update(normalizeInviteCode(value)).digest();

/** Vrai si `given` est le bon code (ou si aucun code n'est demandé). */
export function inviteAccepted(given: unknown) {
  const expected = getServerEnv().SIGNUP_INVITE_CODE;
  if (!expected) return true;
  // Empreintes de même longueur : comparaison en temps constant
  return timingSafeEqual(digest(expected), digest(given));
}

// Essais ratés du code (analyse du 2026-11-12) : sans limite, un code court se
// devine. 10 essais ratés par appareil (adresse IP, gardée en empreinte et en
// mémoire seulement) par 15 minutes, et une courte attente après chaque échec.
// La vraie protection reste un code long (16 caractères ou plus).
const ATTEMPT_WINDOW_MS = 15 * 60_000;
const MAX_FAILED_ATTEMPTS = 10;
const FAILURE_DELAY_MS = 800;
const failures = new Map<string, { since: number; count: number }>();

/** Trop d'essais ratés depuis cet appareil : il faut attendre. */
export function inviteLocked(device: string, now = Date.now()) {
  const entry = failures.get(device);
  return (
    entry !== undefined &&
    now - entry.since < ATTEMPT_WINDOW_MS &&
    entry.count >= MAX_FAILED_ATTEMPTS
  );
}

/** Note un essai raté, puis attend un peu avant de répondre. */
export async function inviteFailed(device: string, now = Date.now()) {
  const entry = failures.get(device);
  if (!entry || now - entry.since >= ATTEMPT_WINDOW_MS) {
    // Le tableau reste petit : on oublie les vieilles entrées de temps en temps
    if (failures.size > 5000) failures.clear();
    failures.set(device, { since: now, count: 1 });
  } else {
    entry.count += 1;
  }
  await new Promise((resolve) => setTimeout(resolve, FAILURE_DELAY_MS));
}

/** L'appareil qui essaie : l'empreinte de son adresse IP (jamais gardée en base). */
export function deviceKey(forwardedFor: string | null, realIp: string | null) {
  const ip = forwardedFor?.split(",")[0]?.trim() || realIp || "inconnu";
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}
