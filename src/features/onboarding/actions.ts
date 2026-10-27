"use server";

import { hasLocale } from "next-intl";
import { APP_HOME_PATH } from "@/features/auth/access";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { toCalendarDay } from "@/lib/dates";
import { profileDetailsSchema } from "@/features/profile/details";
import { requireUser } from "@/server/auth/session";
import { completeOnboarding } from "@/server/onboarding/service";
import { getUserTimeZone } from "@/server/profile/service";
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
    // 16 ans et plus, le jour même dans le fuseau de la personne
    const timeZone = await getUserTimeZone(user.id);
    const details = profileDetailsSchema(
      toCalendarDay(new Date(), timeZone),
    ).safeParse(answers);
    if (!details.success) return { error: "invalid" };
    await completeOnboarding(user.id, parsed.data, details.data);
  } catch (error) {
    console.error("Enregistrement de l'onboarding impossible", error);
    return { error: "unexpected" };
  }

  return redirect({
    href: APP_HOME_PATH,
    locale: hasLocale(routing.locales, locale) ? locale : routing.defaultLocale,
  });
}
