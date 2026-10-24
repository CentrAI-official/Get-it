import { Lock } from "lucide-react";
import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import {
  JournalDayPanel,
  JournalDaySkeleton,
} from "@/features/journal/components/journal-panels";
import { ProfileTabs } from "@/features/profile/components/profile-tabs";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Journal");
  return { title: t("title") };
}

// Profil › Journal : une page par jour, privée
export default function JournalPage({
  searchParams,
}: PageProps<"/[locale]/profile/journal">) {
  const t = useTranslations("Journal");

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <div className="flex flex-col gap-4">
        <ProfileTabs current="journal" />
        <PageHeader title={t("title")} description={t("description")} />
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock aria-hidden="true" className="size-3.5" />
          {t("private")}
        </p>
      </div>
      <Suspense fallback={<JournalDaySkeleton />}>
        <JournalDayPanel searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
