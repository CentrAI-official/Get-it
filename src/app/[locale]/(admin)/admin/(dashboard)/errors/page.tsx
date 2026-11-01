import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { AdminPage } from "@/features/admin/components/admin-page";
import { ErrorsPanel } from "@/features/admin/components/insight-panels";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.errors");
  return { title: t("title") };
}

export default function AdminErrorsPage({
  searchParams,
}: PageProps<"/[locale]/admin/errors">) {
  const t = useTranslations("Admin.errors");

  return (
    <AdminPage title={t("title")} description={t("description")}>
      <ErrorsPanel searchParams={searchParams} />
    </AdminPage>
  );
}
