import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui/skeleton";
import { CommunityFeed } from "@/features/community/components/community-feed";
import { JoinCommunityCard } from "@/features/community/components/join-community-card";
import { listFeed } from "@/server/community/feed";
import { getCommunityMember } from "@/server/community/members";
import { getCurrentProfile } from "@/server/profile/service";

/** Mes publications (Profil). Lit la session : à placer dans un <Suspense>. */
export async function MyPostsPanel() {
  const profile = await getCurrentProfile();
  const member = await getCommunityMember(profile.id);
  if (!member?.joined) return <JoinCommunityCard />;
  const [feed, t] = await Promise.all([
    listFeed(profile.id, undefined, profile.id),
    getTranslations("App.profile.posts"),
  ]);
  return (
    <CommunityFeed
      initialPosts={feed.posts}
      initialCursor={feed.nextCursor}
      now={feed.loadedAt}
      canWrite={!member.suspendedUntil}
      authorId={profile.id}
      empty={{ title: t("emptyTitle"), description: t("emptyDescription") }}
    />
  );
}

export function MyPostsSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {[0, 1].map((index) => (
        <div
          key={index}
          className="flex flex-col gap-3 border-t border-white/8 pt-5"
        >
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-full" />
            <Skeleton className="h-4 w-40" />
          </div>
          <Skeleton className="h-16 w-full" />
        </div>
      ))}
    </div>
  );
}
