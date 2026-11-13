"use server";

import { headers } from "next/headers";
import { hasLocale, type Locale } from "next-intl";
import type { z } from "zod";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import {
  sendPasswordResetEmail,
  signInWithPassword,
  signOut,
  signUpWithPassword,
  updatePassword,
} from "@/server/auth/service";
import {
  deviceKey,
  inviteAccepted,
  inviteFailed,
  inviteLocked,
  inviteRequired,
} from "@/server/auth/invite";
import { legalReady } from "@/server/legal/service";
import { APP_HOME_PATH, getPostLoginPath } from "./access";
import { toFieldErrors, type AuthFormState } from "./form-state";
import { safeNextPath } from "./redirect";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from "./schemas";

// Chaque Server Action est un point d'entrée public : toute entrée est revalidée ici.

function readLocale(value: unknown): Locale {
  return hasLocale(routing.locales, value) ? value : routing.defaultLocale;
}

/** État d'erreur pour une saisie refusée par la validation. */
function invalidInput(error: z.ZodError, formData: FormData): AuthFormState {
  const fieldErrors = toFieldErrors(error);
  const email = formData.get("email");
  return {
    status: "error",
    fieldErrors,
    // Champ caché altéré (ex. langue) : aucune erreur de champ à afficher
    error: Object.keys(fieldErrors).length === 0 ? "unexpected" : undefined,
    email: typeof email === "string" ? email : undefined,
  };
}

export async function signInAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalidInput(parsed.error, formData);

  const result = await signInWithPassword(parsed.data);
  if (!result.ok) {
    return { status: "error", error: result.error, email: parsed.data.email };
  }
  return redirect({
    href: getPostLoginPath(
      result.data.onboarded,
      safeNextPath(parsed.data.next),
    ),
    locale: result.data.locale,
  });
}

export async function signUpAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalidInput(parsed.error, formData);
  // Bêta privée : sans le bon code, aucun compte n'est créé ; les essais ratés
  // sont limités par appareil
  if (inviteRequired()) {
    const requestHeaders = await headers();
    const device = deviceKey(
      requestHeaders.get("x-forwarded-for"),
      requestHeaders.get("x-real-ip"),
    );
    if (inviteLocked(device)) {
      return {
        status: "error",
        error: "rateLimited",
        email: parsed.data.email,
      };
    }
    if (!inviteAccepted(parsed.data.inviteCode)) {
      await inviteFailed(device);
      return {
        status: "error",
        fieldErrors: { inviteCode: "inviteInvalid" },
        email: parsed.data.email,
      };
    }
  }

  // Loi 25 : les conditions et la politique s'acceptent avant de créer le compte
  if (legalReady() && parsed.data.terms !== "on") {
    return {
      status: "error",
      fieldErrors: { terms: "termsRequired" },
      email: parsed.data.email,
    };
  }
  const result = await signUpWithPassword({
    ...parsed.data,
    termsAccepted: parsed.data.terms === "on",
  });
  if (!result.ok) {
    return { status: "error", error: result.error, email: parsed.data.email };
  }
  if (result.data.needsConfirmation) {
    return { status: "success", email: parsed.data.email };
  }
  return redirect({
    href: getPostLoginPath(result.data.onboarded, null),
    locale: result.data.locale,
  });
}

export async function forgotPasswordAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = forgotPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalidInput(parsed.error, formData);

  const result = await sendPasswordResetEmail(parsed.data);
  return result.ok
    ? { status: "success", email: parsed.data.email }
    : { status: "error", error: result.error, email: parsed.data.email };
}

export async function resetPasswordAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = resetPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalidInput(parsed.error, formData);

  const result = await updatePassword(parsed.data.password);
  if (!result.ok) return { status: "error", error: result.error };
  return redirect({ href: APP_HOME_PATH, locale: parsed.data.locale });
}

export async function signOutAction(formData: FormData) {
  await signOut();
  redirect({ href: "/", locale: readLocale(formData.get("locale")) });
}
