import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { NewMessageGate } from "@/features/messages/components/messages-panels";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Messages.search");
  return { title: t("title") };
}

export default function NewMessagePage() {
  const t = useTranslations("Messages.search");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <BackLink href="/messages" label={t("back")} />
      <PageHeader title={t("title")} description={t("description")} />
      <Suspense fallback={<Skeleton className="h-11 rounded-full" />}>
        <NewMessageGate />
      </Suspense>
    </div>
  );
}
