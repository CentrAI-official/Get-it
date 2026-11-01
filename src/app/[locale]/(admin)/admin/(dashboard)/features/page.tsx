import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { AdminPage } from "@/features/admin/components/admin-page";
import { FeaturesPanel } from "@/features/admin/components/dashboard-panels";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.features");
  return { title: t("title") };
}

export default function AdminFeaturesPage({
  searchParams,
}: PageProps<"/[locale]/admin/features">) {
  const t = useTranslations("Admin.features");

  return (
    <AdminPage title={t("title")} description={t("description")}>
      <FeaturesPanel searchParams={searchParams} />
    </AdminPage>
  );
}
