import { getTranslations } from "next-intl/server";
import { requireUser } from "@/server/auth/session";

/** Courriel du compte connecté. Lit la session : à placer dans un <Suspense>. */
export async function AccountEmail() {
  const [user, t] = await Promise.all([
    requireUser(),
    getTranslations("App.settings.account"),
  ]);

  return (
    <dl className="flex min-w-0 flex-col gap-1">
      <dt className="text-sm text-muted-foreground">{t("email")}</dt>
      <dd className="font-medium break-all">{user.email}</dd>
    </dl>
  );
}
