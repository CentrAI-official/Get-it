import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/layout/page-header";
import {
  JournalRecapPanel,
  JournalRecapSkeleton,
} from "@/features/journal/components/journal-panels";
import { ProfileTabs } from "@/features/profile/components/profile-tabs";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Journal.recap");
  return { title: t("title") };
}

// Profil › Journal › Récap de la semaine ou du mois, et anciennes pages
export default function JournalRecapPage({
  searchParams,
}: PageProps<"/[locale]/profile/journal/recap">) {
  const t = useTranslations("Journal.recap");

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <div className="flex flex-col gap-4">
        <ProfileTabs current="journal" />
        <BackLink href="/profile/journal" label={t("back")} />
        <PageHeader title={t("title")} description={t("description")} />
      </div>
      <Suspense fallback={<JournalRecapSkeleton />}>
        <JournalRecapPanel searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
