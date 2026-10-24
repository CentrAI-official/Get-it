import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import {
  MyPostsPanel,
  MyPostsSkeleton,
} from "@/features/profile/components/my-posts";
import { ProfileTabs } from "@/features/profile/components/profile-tabs";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("App.profile.posts");
  return { title: t("title") };
}

// Profil › Publications : ce que j'ai publié dans le Centre
export default function MyPostsPage() {
  const t = useTranslations("App.profile.posts");

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <ProfileTabs current="posts" />
        <PageHeader title={t("title")} description={t("description")} />
      </div>
      <Suspense fallback={<MyPostsSkeleton />}>
        <MyPostsPanel />
      </Suspense>
    </div>
  );
}
