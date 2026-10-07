import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { AuthHeader } from "@/features/auth/components/auth-header";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth.resetPassword");
  return { title: t("metaTitle") };
}

// Accessible avec la session ouverte par le lien reçu par courriel (voir le proxy)
export default function ResetPasswordPage() {
  const t = useTranslations("Auth.resetPassword");

  return (
    <div className="flex flex-col gap-8">
      <AuthHeader title={t("title")} description={t("description")} />
      <ResetPasswordForm />
    </div>
  );
}
