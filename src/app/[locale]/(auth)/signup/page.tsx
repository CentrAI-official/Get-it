import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { AuthHeader } from "@/features/auth/components/auth-header";
import { SignupForm } from "@/features/auth/components/signup-form";
import { Link } from "@/i18n/navigation";
import { inviteRequired } from "@/server/auth/invite";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth.signup");
  return { title: t("metaTitle") };
}

export default function SignupPage() {
  const t = useTranslations("Auth.signup");

  return (
    <div className="flex flex-col gap-8">
      <AuthHeader title={t("title")} description={t("description")} />
      <SignupForm inviteRequired={inviteRequired()} />
      <p className="text-center text-sm text-muted-foreground">
        {t("hasAccount")}{" "}
        <Link
          href="/login"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          {t("loginLink")}
        </Link>
      </p>
    </div>
  );
}
