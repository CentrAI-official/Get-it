import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/layout/page-header";
import {
  LeaderboardPanel,
  LeaderboardSkeleton,
} from "@/features/ranked/components/leaderboard";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Ranked.leaderboard");
  return { title: t("title") };
}

// Profil › Ranked › Classement : toutes les personnes classées, ou mes contacts
export default function LeaderboardPage({
  searchParams,
}: PageProps<"/[locale]/profile/ranked/leaderboard">) {
  const t = useTranslations("Ranked");

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <div className="flex flex-col gap-4">
        <BackLink href="/profile/ranked" label={t("leaderboard.back")} />
        <PageHeader
          title={t("leaderboard.title")}
          description={t("leaderboard.description")}
        />
      </div>
      <Suspense fallback={<LeaderboardSkeleton />}>
        <LeaderboardPanel searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
