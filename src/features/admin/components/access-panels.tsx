import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { requireAdminPassword, verifiedTotpFactors } from "@/server/admin/auth";
import { ADMIN_ENROLL_PATH, ADMIN_VERIFY_PATH } from "../surface";
import { AdminCodeForm, AdminEnrollment } from "./access-forms";

// Étapes de la double authentification, après le mot de passe. À placer dans un <Suspense>.

/** Connexion habituelle : le code de l'application déjà reliée. */
export async function VerifyPanel() {
  await requireAdminPassword();
  if ((await verifiedTotpFactors()).length === 0) {
    redirect({ href: ADMIN_ENROLL_PATH, locale: await getLocale() });
  }
  return <AdminCodeForm />;
}

/** Première connexion : relier une application d'authentification. */
export async function EnrollPanel() {
  await requireAdminPassword();
  if ((await verifiedTotpFactors()).length > 0) {
    redirect({ href: ADMIN_VERIFY_PATH, locale: await getLocale() });
  }
  return <AdminEnrollment />;
}
