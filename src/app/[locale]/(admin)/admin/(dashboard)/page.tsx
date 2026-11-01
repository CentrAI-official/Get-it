import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { AdminPage } from "@/features/admin/components/admin-page";
import { OverviewPanel } from "@/features/admin/components/dashboard-panels";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.overview");
  return { title: t("title") };
}

export default function AdminOverviewPage({
  searchParams,
}: PageProps<"/[locale]/admin">) {
  const t = useTranslations("Admin.overview");

  return (
    <AdminPage title={t("title")} description={t("description")}>
      <OverviewPanel searchParams={searchParams} />
    </AdminPage>
  );
}
