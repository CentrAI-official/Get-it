import "server-only";
import type { AuthError, EmailOtpType, User } from "@supabase/supabase-js";
import type { Locale } from "next-intl";
import { siteConfig } from "@/config/site";
import { APP_HOME_PATH, RESET_PASSWORD_PATH } from "@/features/auth/access";
import { toAuthErrorKey, type AuthErrorKey } from "@/features/auth/errors";
import { normalizeInviteCode } from "@/features/auth/invite";
import { inviteAccepted, inviteRequired } from "@/server/auth/invite";
import { getSessionUser } from "@/server/auth/session";
import { ensureProfile, hasProfile } from "@/server/profile/service";
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

/** Session ouverte : langue enregistrée dans le compte et état de l'onboarding. */
export type OpenedSession = { locale: Locale; onboarded: boolean };

/**
 * Ouvre la session dans Get iT : crée le profil au besoin. En bêta privée, un
 * nouveau profil demande le code d'invitation donné à l'inscription : un compte
 * créé en contournant le formulaire n'entre pas (« inviteRequired »).
 */
async function openSession(
  user: User,
  fallbackLocale: Locale,
): Promise<AuthResult<OpenedSession>> {
  try {
    if (
      inviteRequired() &&
      !inviteAccepted(user.user_metadata["invite_code"]) &&
      !(await hasProfile(user.id))
    ) {
      return { ok: false, error: "inviteRequired" };
    }
    const session = await ensureProfile(user.id, {
      locale: user.user_metadata["locale"] ?? fallbackLocale,
      timeZone: user.user_metadata["time_zone"],
    });
    return { ok: true, data: session };
  } catch (error) {
    console.error("Création du profil impossible", error);
    return { ok: false, error: "unexpected" };
  }
}

export async function signInWithPassword(input: {
  email: string;
  password: string;
  locale: Locale;
}): Promise<AuthResult<OpenedSession>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  });
  if (error || !data.user) return failure(error);
  return closeIfRefused(supabase, await openSession(data.user, input.locale));
}

/** Compte refusé (sans invitation) : la session tout juste ouverte est refermée. */
async function closeIfRefused<T>(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  result: AuthResult<T>,
): Promise<AuthResult<T>> {
  if (!result.ok && result.error === "inviteRequired") {
    await supabase.auth.signOut();
  }
  return result;
}

export async function signUpWithPassword(input: {
  email: string;
  password: string;
  locale: Locale;
  timeZone?: string;
  inviteCode?: string;
}): Promise<
  AuthResult<
    { needsConfirmation: true } | ({ needsConfirmation: false } & OpenedSession)
  >
> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      emailRedirectTo: emailLinkUrl(input.locale, APP_HOME_PATH),
      // Préférences reprises à la création du profil, après la confirmation du courriel
      data: {
        locale: input.locale,
        time_zone: input.timeZone,
        // Revérifié à la création du profil (bêta privée)
        ...(input.inviteCode
          ? { invite_code: normalizeInviteCode(input.inviteCode) }
          : {}),
      },
    },
  });
  if (error) return failure(error);

  // Confirmation du courriel activée (par défaut) : pas encore de session
  if (!data.user || !data.session) {
    return { ok: true, data: { needsConfirmation: true } };
  }
  const session = await closeIfRefused(
    supabase,
    await openSession(data.user, input.locale),
  );
  return session.ok
    ? {
        ok: true,
        data: { needsConfirmation: false, ...session.data },
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
    redirectTo: emailLinkUrl(input.locale, RESET_PASSWORD_PATH),
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
}): Promise<AuthResult<OpenedSession>> {
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
  return closeIfRefused(supabase, await openSession(data.user, input.locale));
}
