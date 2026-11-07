import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import {
  ProMessages,
  ProSkeleton,
} from "@/features/pages/components/pro-views";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Pages.inbox");
  return { title: t("title") };
}

// La boîte de messages de la page pro
export default async function ProMessagesPage() {
  const t = await getTranslations("Pages.inbox");
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <h1 className="sr-only">{t("title")}</h1>
      <Suspense fallback={<ProSkeleton />}>
        <ProMessages />
      </Suspense>
    </div>
  );
}
