import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import {
  ProfileOverview,
  ProfileOverviewSkeleton,
} from "@/features/profile/components/profile-overview";
import { ProfileTabs } from "@/features/profile/components/profile-tabs";
import { ProgressionOverview } from "@/features/profile/components/progression-overview";
import { DayPanelCard } from "@/features/today/components/day-panel-card";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("App.profile");
  return { title: t("title") };
}

export default function ProfilePage() {
  const t = useTranslations("App.profile");

  return (
    <div className="flex flex-col gap-8">
      <ProfileTabs current="overview" />
      <h1 className="sr-only">{t("title")}</h1>
      <Suspense fallback={<ProfileOverviewSkeleton />}>
        <ProfileOverview
          day={<DayPanelCard />}
          progression={<ProgressionOverview />}
        />
      </Suspense>
    </div>
  );
}
