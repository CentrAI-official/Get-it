import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { EnrollPanel } from "@/features/admin/components/access-panels";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.access.enroll");
  return { title: t("title") };
}

export default function AdminEnrollPage() {
  const t = useTranslations("Admin.access.enroll");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("description")} />
      <Suspense fallback={<Skeleton className="h-80" />}>
        <EnrollPanel />
      </Suspense>
    </div>
  );
}
