"use server";

import { hasLocale } from "next-intl";
import { APP_HOME_PATH } from "@/features/auth/access";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { requireUser } from "@/server/auth/session";
import { completeOnboarding } from "@/server/onboarding/service";
import { onboardingSchema } from "./schemas";

export type OnboardingActionResult = { error: "invalid" | "unexpected" };

/** Enregistre l'onboarding puis ouvre l'application. Point d'entrée public : tout est revalidé. */
export async function completeOnboardingAction(
  answers: unknown,
  locale: unknown,
): Promise<OnboardingActionResult> {
  const user = await requireUser();
  const parsed = onboardingSchema.safeParse(answers);
  if (!parsed.success) return { error: "invalid" };

  try {
    await completeOnboarding(user.id, parsed.data);
  } catch (error) {
    console.error("Enregistrement de l'onboarding impossible", error);
    return { error: "unexpected" };
  }

  return redirect({
    href: APP_HOME_PATH,
    locale: hasLocale(routing.locales, locale) ? locale : routing.defaultLocale,
  });
}
