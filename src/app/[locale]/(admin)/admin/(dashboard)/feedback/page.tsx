import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { AdminPage } from "@/features/admin/components/admin-page";
import { FeedbackPanel } from "@/features/admin/components/insight-panels";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.feedback");
  return { title: t("title") };
}

export default function AdminFeedbackPage({
  searchParams,
}: PageProps<"/[locale]/admin/feedback">) {
  const t = useTranslations("Admin.feedback");

  return (
    <AdminPage title={t("title")} description={t("description")}>
      <FeedbackPanel searchParams={searchParams} />
    </AdminPage>
  );
}
