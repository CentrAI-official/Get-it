import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { AdminPage } from "@/features/admin/components/admin-page";
import { RetentionPanel } from "@/features/admin/components/dashboard-panels";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.retention");
  return { title: t("title") };
}

export default function AdminRetentionPage({
  searchParams,
}: PageProps<"/[locale]/admin/retention">) {
  const t = useTranslations("Admin.retention");

  return (
    <AdminPage title={t("title")} description={t("description")}>
      <RetentionPanel searchParams={searchParams} />
    </AdminPage>
  );
}
