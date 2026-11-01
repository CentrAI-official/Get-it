import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { VerifyPanel } from "@/features/admin/components/access-panels";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.access.verify");
  return { title: t("title") };
}

export default function AdminVerifyPage() {
  const t = useTranslations("Admin.access.verify");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("description")} />
      <Suspense fallback={<Skeleton className="h-40" />}>
        <VerifyPanel />
      </Suspense>
    </div>
  );
}
