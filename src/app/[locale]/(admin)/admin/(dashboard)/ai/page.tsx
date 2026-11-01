import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { AdminPage } from "@/features/admin/components/admin-page";
import { AiPanel } from "@/features/admin/components/dashboard-panels";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.ai");
  return { title: t("title") };
}

export default function AdminAiPage({
  searchParams,
}: PageProps<"/[locale]/admin/ai">) {
  const t = useTranslations("Admin.ai");

  return (
    <AdminPage title={t("title")} description={t("description")}>
      <AiPanel searchParams={searchParams} />
    </AdminPage>
  );
}
