import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { AdminSignInForm } from "@/features/admin/components/access-forms";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.access.signIn");
  return { title: t("title") };
}

export default function AdminSignInPage() {
  const t = useTranslations("Admin.access.signIn");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} />
      <AdminSignInForm />
    </div>
  );
}
