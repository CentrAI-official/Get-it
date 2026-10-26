import { MessagesSquare } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { recordIdSchema } from "@/features/goals/schemas";
import { getFeedPost } from "@/server/community/feed";
import { getCommunityMember } from "@/server/community/members";
import { getCurrentProfile } from "@/server/profile/service";
import { CommunityFeed } from "./community-feed";
import { JoinCommunityCard } from "./join-community-card";

/**
 * Une publication ouverte par son lien (« Copier le lien ») : réservée aux
 * membres du Centre, avec les mêmes règles de visibilité que le fil. Lit la
 * session : à placer dans un <Suspense>.
 */
export async function PostPageLoader({ postId }: { postId: string }) {
  const profile = await getCurrentProfile();
  const member = await getCommunityMember(profile.id);
  if (!member?.joined) return <JoinCommunityCard />;
  const [found, t] = await Promise.all([
    recordIdSchema.safeParse(postId).success
      ? getFeedPost(profile.id, postId)
      : null,
    getTranslations("Community.postPage"),
  ]);
  const empty = {
    title: t("notFoundTitle"),
    description: t("notFoundDescription"),
  };
  if (!found) {
    return (
      <EmptyState
        icon={MessagesSquare}
        title={empty.title}
        description={empty.description}
      />
    );
  }
  return (
    <CommunityFeed
      initialPosts={[found.post]}
      initialCursor={null}
      now={found.loadedAt}
      canWrite={!member.suspendedUntil}
      empty={empty}
      single
    />
  );
}

export function PostPageSkeleton() {
  return (
    <div className="flex flex-col gap-3 border-t border-white/8 pt-5">
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 rounded-full" />
        <Skeleton className="h-4 w-40" />
      </div>
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>
  );
}
