import { Sparkles } from "lucide-react";
import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/layout/page-header";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("App.coach");
  return { title: t("title") };
}

export default function CoachPage() {
  const t = useTranslations("App.coach");

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t("title")} description={t("question")} />
      <EmptyState
        icon={Sparkles}
        title={t("emptyTitle")}
        description={t("emptyDescription")}
      />
    </div>
  );
}
