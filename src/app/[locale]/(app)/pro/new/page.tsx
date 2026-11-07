import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/layout/page-header";
import { ProNew, ProSkeleton } from "@/features/pages/components/pro-views";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Pages.new");
  return { title: t("title") };
}

// Créer sa page pro
export default function ProNewPage() {
  const t = useTranslations("Pages.new");
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <BackLink href="/profile" label={t("back")} />
      <PageHeader title={t("title")} description={t("description")} />
      <Suspense fallback={<ProSkeleton />}>
        <ProNew />
      </Suspense>
    </div>
  );
}
