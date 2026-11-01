import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { AdminPage } from "@/features/admin/components/admin-page";
import { AuditPanel } from "@/features/admin/components/dashboard-panels";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.audit");
  return { title: t("title") };
}

export default function AdminAuditPage() {
  const t = useTranslations("Admin.audit");

  return (
    <AdminPage title={t("title")} description={t("description")}>
      <AuditPanel />
    </AdminPage>
  );
}
