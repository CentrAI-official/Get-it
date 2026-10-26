// Code d'invitation de la bêta privée : la saisie est comparée sans espaces
// autour et sans tenir compte des majuscules. La comparaison elle-même se fait
// côté serveur (src/server/auth/invite.ts).

/** Code tel que comparé : sans espaces autour, en majuscules ; "" s'il manque. */
export function normalizeInviteCode(value: unknown): string {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}
