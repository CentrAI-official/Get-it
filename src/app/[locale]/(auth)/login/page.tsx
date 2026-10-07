import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { AuthHeader } from "@/features/auth/components/auth-header";
import { LoginForm } from "@/features/auth/components/login-form";
import { Link } from "@/i18n/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth.login");
  return { title: t("metaTitle") };
}

export default function LoginPage() {
  const t = useTranslations("Auth.login");

  return (
    <div className="flex flex-col gap-8">
      <AuthHeader title={t("title")} description={t("description")} />
      <LoginForm />
      <p className="text-center text-sm text-muted-foreground">
        {t("noAccount")}{" "}
        <Link
          href="/signup"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          {t("signupLink")}
        </Link>
      </p>
    </div>
  );
}
