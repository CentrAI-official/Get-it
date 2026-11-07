import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/layout/page-header";
import { ProEdit, ProSkeleton } from "@/features/pages/components/pro-views";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Pages.edit");
  return { title: t("title") };
}

// Modifier sa page pro
export default function ProEditPage() {
  const t = useTranslations("Pages.edit");
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <BackLink href="/pro" label={t("back")} />
      <PageHeader title={t("title")} />
      <Suspense fallback={<ProSkeleton />}>
        <ProEdit />
      </Suspense>
    </div>
  );
}
