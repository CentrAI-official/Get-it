import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/layout/page-header";
import { FeedbackForm } from "@/features/feedback/components/feedback-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Feedback");
  return { title: t("title") };
}

export default function FeedbackPage() {
  const t = useTranslations("Feedback");

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <BackLink href="/settings" label={t("back")} />
      <PageHeader title={t("title")} description={t("description")} />
      <FeedbackForm />
    </div>
  );
}
