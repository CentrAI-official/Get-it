/** Étapes de l'onboarding (§10), dans l'ordre. */
export const ONBOARDING_STEPS = [
  "about",
  "pillars",
  "goals",
  "situation",
  "time",
  "summary",
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];
