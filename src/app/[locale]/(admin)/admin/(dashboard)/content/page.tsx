import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { AdminPage } from "@/features/admin/components/admin-page";
import { ContentPanel } from "@/features/admin/components/insight-panels";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.content");
  return { title: t("title") };
}

export default function AdminContentPage({
  searchParams,
}: PageProps<"/[locale]/admin/content">) {
  const t = useTranslations("Admin.content");

  return (
    <AdminPage title={t("title")} description={t("description")}>
      <ContentPanel searchParams={searchParams} />
    </AdminPage>
  );
}
