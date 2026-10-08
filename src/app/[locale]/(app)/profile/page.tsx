import { Trophy } from "lucide-react";
import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import {
  ProfileOverview,
  ProfileOverviewSkeleton,
} from "@/features/profile/components/profile-overview";

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
        <ProfileOverview />
      </Suspense>
      {/* Étape 7 : niveaux, XP et badges */}
      <EmptyState
        icon={Trophy}
        title={t("emptyTitle")}
        description={t("emptyDescription")}
      />
    </div>
  );
}
