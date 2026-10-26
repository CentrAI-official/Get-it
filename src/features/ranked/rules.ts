// Règles du mode Ranked (fonctions pures) ; le calcul du niveau est dans
// scoring.ts, les tableaux de référence dans reference.ts.

/** Une réévaluation au plus tous les 30 jours : le niveau peut monter ou descendre. */
export const RANKED_COOLDOWN_DAYS = 30;

/** Date de la prochaine réévaluation possible. */
export function nextEvaluationAt(lastAt: Date) {
  return new Date(lastAt.getTime() + RANKED_COOLDOWN_DAYS * 86_400_000);
}

export const RANKED_ERRORS = [
  "invalid",
  "consentRequired",
  "tooSoon",
  "notRanked",
  "notConfigured",
  "aiConsentRequired",
  "limitReached",
  "refused",
  "unexpected",
] as const;
export type RankedError = (typeof RANKED_ERRORS)[number];
