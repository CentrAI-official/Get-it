import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/layout/page-header";
import {
  ListingSkeleton,
  ApprovalsPanel,
} from "@/features/marketplace/components/marketplace-panels";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Marketplace.approvals");
  return { title: t("title") };
}

export default function ApprovalsPage() {
  const t = useTranslations("Marketplace.approvals");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <BackLink href="/marketplace" label={t("back")} />
      <PageHeader title={t("title")} description={t("description")} />
      <Suspense fallback={<ListingSkeleton />}>
        <ApprovalsPanel />
      </Suspense>
    </div>
  );
}
