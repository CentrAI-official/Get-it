/** Étapes de l'onboarding (§10), dans l'ordre. */
export const ONBOARDING_STEPS = [
  "account",
  "about",
  "details",
  "pillars",
  "goals",
  "time",
  "summary",
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];
