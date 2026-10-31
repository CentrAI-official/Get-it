import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import {
  FollowListLoader,
  FollowListSkeleton,
} from "@/features/follows/components/follow-list";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Follows");
  return { title: t("followersTitle") };
}

// Abonnés d'un membre du Centre
export default function FollowersPage({
  params,
}: PageProps<"/[locale]/community/members/[username]/followers">) {
  const t = useTranslations("Follows");

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      {/* Le nom n'est connu qu'à la requête : lu dans le Suspense */}
      <Suspense fallback={<FollowListSkeleton />}>
        {params.then(({ username }) => (
          <>
            <BackLink
              href={`/community/members/${username}`}
              label={t("backToProfile")}
            />
            <FollowListLoader
              username={decodeURIComponent(username)}
              list="followers"
            />
          </>
        ))}
      </Suspense>
    </div>
  );
}
