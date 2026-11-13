"use server";

import { hasLocale } from "next-intl";
import { APP_HOME_PATH } from "@/features/auth/access";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { requireUser } from "@/server/auth/session";
import { acceptTerms, legalReady } from "@/server/legal/service";

export type AcceptTermsState = { error: "required" | "unexpected" | null };

/** Les conditions et la politique acceptées : on continue vers l'application. */
export async function acceptTermsAction(
  _previous: AcceptTermsState,
  formData: FormData,
): Promise<AcceptTermsState> {
  const user = await requireUser();
  const value = formData.get("locale");
  const locale = hasLocale(routing.locales, value)
    ? value
    : routing.defaultLocale;
  if (!legalReady()) return redirect({ href: APP_HOME_PATH, locale });
  if (formData.get("terms") !== "on") return { error: "required" };
  try {
    await acceptTerms(user.id);
  } catch (error) {
    console.error("Acceptation des conditions non enregistrée", error);
    return { error: "unexpected" };
  }
  return redirect({ href: APP_HOME_PATH, locale });
}
