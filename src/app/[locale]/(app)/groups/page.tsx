import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import {
  GroupsPanel,
  GroupsSkeleton,
} from "@/features/groups/components/groups-panels";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("App.groups");
  return { title: t("title") };
}

// Groupes de la Communauté : forums publics et discussions privées
export default function GroupsPage({
  searchParams,
}: PageProps<"/[locale]/groups">) {
  const t = useTranslations("App.groups");

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <PageHeader title={t("title")} description={t("question")} />
      <Suspense fallback={<GroupsSkeleton />}>
        <GroupsPanel searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
