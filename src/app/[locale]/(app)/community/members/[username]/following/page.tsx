import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import {
  FollowBackLink,
  FollowListLoader,
  FollowListSkeleton,
} from "@/features/follows/components/follow-list";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Follows");
  return { title: t("followingTitle") };
}

// Comptes que suit un membre du Centre
export default function FollowingPage({
  params,
}: PageProps<"/[locale]/community/members/[username]/following">) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      {/* Le nom n'est connu qu'à la requête : lu dans le Suspense */}
      <Suspense fallback={<FollowListSkeleton />}>
        {params.then(({ username }) => (
          <>
            <FollowBackLink username={decodeURIComponent(username)} />
            <FollowListLoader
              username={decodeURIComponent(username)}
              list="following"
            />
          </>
        ))}
      </Suspense>
    </div>
  );
}
