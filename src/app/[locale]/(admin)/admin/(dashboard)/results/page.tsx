import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { AdminPage } from "@/features/admin/components/admin-page";
import { ResultsPanel } from "@/features/admin/components/insight-panels";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.results");
  return { title: t("title") };
}

export default function AdminResultsPage({
  searchParams,
}: PageProps<"/[locale]/admin/results">) {
  const t = useTranslations("Admin.results");

  return (
    <AdminPage title={t("title")} description={t("description")}>
      <ResultsPanel searchParams={searchParams} />
    </AdminPage>
  );
}
