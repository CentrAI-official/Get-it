import "server-only";
import type { AuthError, EmailOtpType, User } from "@supabase/supabase-js";
import type { Locale } from "next-intl";
import { siteConfig } from "@/config/site";
import { APP_HOME_PATH } from "@/features/auth/access";
import { toAuthErrorKey, type AuthErrorKey } from "@/features/auth/errors";
import { getSessionUser } from "@/server/auth/session";
import { ensureProfile } from "@/server/profile/service";
import { createSupabaseServerClient } from "@/server/supabase/server";

export type AuthResult<T = undefined> =
  { ok: true; data: T } | { ok: false; error: AuthErrorKey };

const failure = (
  error: AuthError | null,
): { ok: false; error: AuthErrorKey } => ({
  ok: false,
  error: toAuthErrorKey(error?.code),
});

/** Lien reçu par courriel : /[locale]/auth/confirm ouvre la session puis mène à `next`. */
function emailLinkUrl(locale: Locale, next: string) {
  const url = new URL(`/${locale}/auth/confirm`, siteConfig.url);
  url.searchParams.set("next", next);
  return url.toString();
}

/** Ouvre la session dans Get iT : crée le profil au besoin et renvoie la langue enregistrée. */
async function openSession(
  user: User,
  fallbackLocale: Locale,
): Promise<AuthResult<{ locale: Locale }>> {
  try {
    const { locale } = await ensureProfile(user.id, {
      locale: user.user_metadata["locale"] ?? fallbackLocale,
      timeZone: user.user_metadata["time_zone"],
    });
    return { ok: true, data: { locale } };
  } catch (error) {
    console.error("Création du profil impossible", error);
    return { ok: false, error: "unexpected" };
  }
}

export async function signInWithPassword(input: {
  email: string;
  password: string;
  locale: Locale;
}): Promise<AuthResult<{ locale: Locale }>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  });
  if (error || !data.user) return failure(error);
  return openSession(data.user, input.locale);
}

export async function signUpWithPassword(input: {
  email: string;
  password: string;
  locale: Locale;
  timeZone?: string;
}): Promise<
  AuthResult<
    { needsConfirmation: true } | { needsConfirmation: false; locale: Locale }
  >
> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      emailRedirectTo: emailLinkUrl(input.locale, APP_HOME_PATH),
      // Préférences reprises à la création du profil, après la confirmation du courriel
      data: { locale: input.locale, time_zone: input.timeZone },
    },
  });
  if (error) return failure(error);

  // Confirmation du courriel activée (par défaut) : pas encore de session
  if (!data.user || !data.session) {
    return { ok: true, data: { needsConfirmation: true } };
  }
  const session = await openSession(data.user, input.locale);
  return session.ok
    ? {
        ok: true,
        data: { needsConfirmation: false, locale: session.data.locale },
      }
    : session;
}

/** Envoie le lien de réinitialisation. Ne révèle jamais si un compte existe pour cette adresse. */
export async function sendPasswordResetEmail(input: {
  email: string;
  locale: Locale;
}): Promise<AuthResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(input.email, {
    redirectTo: emailLinkUrl(input.locale, "/reset-password"),
  });
  const key = error ? toAuthErrorKey(error.code) : null;
  if (key === "rateLimited" || key === "emailInvalid") {
    return { ok: false, error: key };
  }
  if (error)
    console.error("Envoi du lien de réinitialisation impossible", error);
  return { ok: true, data: undefined };
}

export async function updatePassword(password: string): Promise<AuthResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "sessionExpired" };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password });
  return error ? failure(error) : { ok: true, data: undefined };
}

/** Ferme la session sur cet appareil seulement. */
export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut({ scope: "local" });
}

const EMAIL_LINK_TYPES = new Set<EmailOtpType>([
  "email",
  "signup",
  "recovery",
  "email_change",
  "invite",
  "magiclink",
]);

function isEmailLinkType(value: string | null): value is EmailOtpType {
  return value !== null && EMAIL_LINK_TYPES.has(value);
}

/**
 * Ouvre la session à partir d'un lien reçu par courriel (confirmation, réinitialisation).
 * Deux formats : `token_hash` + `type` (fonctionne sur tout appareil) ou `code`
 * (même navigateur que la demande).
 */
export async function completeEmailLink(input: {
  tokenHash: string | null;
  type: string | null;
  code: string | null;
  locale: Locale;
}): Promise<AuthResult<{ locale: Locale }>> {
  const supabase = await createSupabaseServerClient();

  let result;
  if (input.tokenHash && isEmailLinkType(input.type)) {
    result = await supabase.auth.verifyOtp({
      type: input.type,
      token_hash: input.tokenHash,
    });
  } else if (input.code) {
    result = await supabase.auth.exchangeCodeForSession(input.code);
  } else {
    return { ok: false, error: "linkInvalid" };
  }

  const { data, error } = result;
  if (error || !data.user) {
    const key = toAuthErrorKey(error?.code);
    return { ok: false, error: key === "unexpected" ? "linkInvalid" : key };
  }
  return openSession(data.user, input.locale);
}
