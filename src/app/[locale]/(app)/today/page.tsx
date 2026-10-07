import { Sun } from "lucide-react";
import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/layout/page-header";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("App.today");
  return { title: t("title") };
}

export default function TodayPage() {
  const t = useTranslations("App.today");

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t("title")} description={t("question")} />
      <EmptyState
        icon={Sun}
        title={t("emptyTitle")}
        description={t("emptyDescription")}
      />
    </div>
  );
}
