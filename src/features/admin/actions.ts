"use server";

import { hasLocale } from "next-intl";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import {
  isAdminSurface,
  requireAdminPassword,
  verifiedTotpFactors,
} from "@/server/admin/auth";
import { logAdminAccess } from "@/server/admin/audit";
import { toAuthErrorKey } from "@/features/auth/errors";
import { db } from "@/server/db";
import { createSupabaseServerClient } from "@/server/supabase/server";
import {
  adminCodeSchema,
  adminSignInSchema,
  type AdminFormState,
} from "./schemas";
import {
  ADMIN_ENROLL_PATH,
  ADMIN_PATH,
  ADMIN_SIGN_IN_PATH,
  ADMIN_VERIFY_PATH,
} from "./surface";

// Connexion à l'application admin. Chaque action est un point d'entrée public :
// elle revérifie qu'elle tourne sur l'application admin, puis le rôle en base.

/** Mot de passe : réservé aux membres de l'équipe, puis l'étape du code. */
export async function adminSignInAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  if (!isAdminSurface()) return { error: "denied" };
  const parsed = adminSignInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error || !data.user) {
    // Le code seulement, jamais le courriel ni le mot de passe
    console.error(
      "Connexion admin refusée par Supabase",
      error?.code ?? error?.name,
    );
    const key = toAuthErrorKey(error?.code);
    return {
      error:
        key === "invalidCredentials" || key === "emailNotConfirmed"
          ? "denied"
          : key === "rateLimited"
            ? "rateLimited"
            : // Réseau ou panne de Supabase : ce n'est pas le mot de passe
              "unavailable",
    };
  }

  const profile = await db.profile.findUnique({
    where: { id: data.user.id },
    select: { role: true },
  });
  if (profile?.role !== "admin") {
    // Même message qu'un mauvais mot de passe : on ne dit pas qui est de l'équipe
    await supabase.auth.signOut();
    return { error: "denied" };
  }

  let linked: boolean;
  try {
    linked = (await verifiedTotpFactors()).length > 0;
  } catch (error) {
    console.error("Facteurs d'authentification illisibles", error);
    return { error: "unexpected" };
  }
  return redirect({
    href: linked ? ADMIN_VERIFY_PATH : ADMIN_ENROLL_PATH,
    locale: parsed.data.locale,
  });
}

export type Enrollment =
  | { ok: true; factorId: string; qrCode: string; secret: string }
  | { ok: false };

/**
 * Première connexion : relie une application d'authentification (Google
 * Authenticator, 1Password…). Les liaisons commencées et jamais terminées sont
 * retirées avant d'en commencer une nouvelle.
 */
export async function startEnrollmentAction(): Promise<Enrollment> {
  await requireAdminPassword();
  const supabase = await createSupabaseServerClient();
  try {
    const { data: factors, error: listError } =
      await supabase.auth.mfa.listFactors();
    if (listError) throw listError;
    if (factors.totp.length > 0) return { ok: false };
    for (const factor of factors.all) {
      if (factor.factor_type === "totp" && factor.status === "unverified") {
        await supabase.auth.mfa.unenroll({ factorId: factor.id });
      }
    }
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Get iT admin",
      issuer: "Get iT",
    });
    if (error) throw error;
    return {
      ok: true,
      factorId: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
    };
  } catch (error) {
    console.error(
      "Liaison de l'application d'authentification impossible",
      error,
    );
    return { ok: false };
  }
}

/** Code à 6 chiffres : termine la liaison ou la connexion, puis le dashboard. */
export async function verifyAdminCodeAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const admin = await requireAdminPassword();
  const parsed = adminCodeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "code" };

  const supabase = await createSupabaseServerClient();
  const { data: factors, error: listError } =
    await supabase.auth.mfa.listFactors();
  if (listError) return { error: "unexpected" };
  // L'application en cours de liaison doit appartenir à cette personne
  const factor = parsed.data.factorId
    ? factors.all.find(
        (candidate) =>
          candidate.id === parsed.data.factorId &&
          candidate.factor_type === "totp",
      )
    : factors.totp[0];
  if (!factor) return { error: "unexpected" };

  const { error } = await supabase.auth.mfa.challengeAndVerify({
    factorId: factor.id,
    code: parsed.data.code,
  });
  if (error) return { error: "code" };

  await logAdminAccess(admin.id, "sign_in");
  return redirect({ href: ADMIN_PATH, locale: parsed.data.locale });
}

export async function adminSignOutAction(formData: FormData) {
  const value = formData.get("locale");
  const locale = hasLocale(routing.locales, value)
    ? value
    : routing.defaultLocale;
  if (isAdminSurface()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut().catch(() => undefined);
  }
  redirect({ href: ADMIN_SIGN_IN_PATH, locale });
}
