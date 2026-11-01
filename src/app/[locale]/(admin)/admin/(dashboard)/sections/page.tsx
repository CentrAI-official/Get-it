import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { AdminPage } from "@/features/admin/components/admin-page";
import { SectionsPanel } from "@/features/admin/components/dashboard-panels";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.sections");
  return { title: t("title") };
}

export default function AdminSectionsPage({
  searchParams,
}: PageProps<"/[locale]/admin/sections">) {
  const t = useTranslations("Admin.sections");

  return (
    <AdminPage title={t("title")} description={t("description")}>
      <SectionsPanel searchParams={searchParams} />
    </AdminPage>
  );
}
