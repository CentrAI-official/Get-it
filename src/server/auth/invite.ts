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
