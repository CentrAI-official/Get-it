import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui/skeleton";
import { CommunityFeed } from "@/features/community/components/community-feed";
import { JoinCommunityCard } from "@/features/community/components/join-community-card";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { listFeed } from "@/server/community/feed";
import { getCommunityMember } from "@/server/community/members";
import { listSavedPosts } from "@/server/community/saves";
import { getCurrentProfile } from "@/server/profile/service";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Mes publications, ou mes publications enregistrées (`?view=saved`) : un
 * bouton passe de l'une à l'autre. Lit la session : à placer dans un <Suspense>.
 */
export async function MyPostsPanel({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const profile = await getCurrentProfile();
  const member = await getCommunityMember(profile.id);
  if (!member?.joined) return <JoinCommunityCard />;
  const view = (await searchParams).view === "saved" ? "saved" : "mine";
  const [feed, t] = await Promise.all([
    view === "saved"
      ? listSavedPosts(profile.id)
      : listFeed(profile.id, undefined, profile.id),
    getTranslations("App.profile.posts"),
  ]);
  return (
    <div className="flex flex-col gap-5">
      <nav
        aria-label={t("tabsLabel")}
        className="flex w-fit gap-0.5 rounded-full bg-white/5 p-1"
      >
        {(["mine", "saved"] as const).map((value) => (
          <Link
            key={value}
            href={
              value === "saved" ? "/profile/posts?view=saved" : "/profile/posts"
            }
            aria-current={view === value ? "page" : undefined}
            className={cn(
              "flex h-8 items-center rounded-full px-3.5 text-sm font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              view === value
                ? "bg-white/12 text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t(value)}
          </Link>
        ))}
      </nav>
      <CommunityFeed
        // Un fil neuf à chaque changement de vue
        key={view}
        initialPosts={feed.posts}
        initialCursor={feed.nextCursor}
        now={feed.loadedAt}
        canWrite={!member.suspendedUntil}
        authorId={view === "mine" ? profile.id : undefined}
        saved={view === "saved"}
        empty={
          view === "saved"
            ? {
                title: t("savedEmptyTitle"),
                description: t("savedEmptyDescription"),
              }
            : { title: t("emptyTitle"), description: t("emptyDescription") }
        }
      />
    </div>
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
