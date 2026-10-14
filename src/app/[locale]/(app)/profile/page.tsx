import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import {
  ProfileOverview,
  ProfileOverviewSkeleton,
} from "@/features/profile/components/profile-overview";
import { ProgressionOverview } from "@/features/profile/components/progression-overview";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("App.profile");
  return { title: t("title") };
}

export default function ProfilePage() {
  const t = useTranslations("App.profile");

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t("title")} description={t("question")} />
      <Suspense fallback={<ProfileOverviewSkeleton />}>
        <ProfileOverview progression={<ProgressionOverview />} />
      </Suspense>
    </div>
  );
}
