import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { AuthHeader } from "@/features/auth/components/auth-header";
import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form";
import { Link } from "@/i18n/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth.forgotPassword");
  return { title: t("metaTitle") };
}

export default function ForgotPasswordPage() {
  const t = useTranslations("Auth.forgotPassword");

  return (
    <div className="flex flex-col gap-8">
      <AuthHeader title={t("title")} description={t("description")} />
      <ForgotPasswordForm />
      <p className="text-center text-sm">
        <Link
          href="/login"
          className="font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {t("backToLogin")}
        </Link>
      </p>
    </div>
  );
}
