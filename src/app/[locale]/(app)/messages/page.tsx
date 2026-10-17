import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import {
  InboxSkeleton,
  MessagesHome,
} from "@/features/messages/components/messages-panels";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("App.messages");
  return { title: t("title") };
}

export default function MessagesPage() {
  const t = useTranslations("App.messages");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeader title={t("title")} description={t("question")} />
      <Suspense fallback={<InboxSkeleton />}>
        <MessagesHome />
      </Suspense>
    </div>
  );
}
