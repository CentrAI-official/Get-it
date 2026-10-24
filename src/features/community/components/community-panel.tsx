import { ShieldAlert, ShieldCheck } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { avatarUrl } from "@/server/profile/avatar";
import { listFeed } from "@/server/community/feed";
import { storageEnabled } from "@/server/storage/service";
import { getCommunityMember, isModerator } from "@/server/community/members";
import { listShareableProgress } from "@/server/community/posts";
import { listProgressStories } from "@/server/community/stories";
import { getCurrentProfile } from "@/server/profile/service";
import { CommunityFeed } from "./community-feed";
import { JoinCommunityCard } from "./join-community-card";
import { PostComposer } from "./post-composer";
import { ProgressStories } from "./progress-stories";

/**
 * Le Centre Get iT : rejoindre (nom d'utilisateur et règles), publier, puis le
 * fil. Lit la session : à placer dans un <Suspense>.
 */
export async function CommunityPanel({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await getCurrentProfile();
  const member = await getCommunityMember(profile.id);
  if (!member?.joined) {
    return <JoinCommunityCard />;
  }

  // L'heure courante est lue après la session : jamais pendant le prérendu
  const now = new Date();
  const [params, feed, stories, shareable, myAvatar, t, format] =
    await Promise.all([
      searchParams,
      listFeed(profile.id),
      listProgressStories(profile.id, now),
      member.suspendedUntil ? [] : listShareableProgress(profile.id),
      avatarUrl(profile.avatarPath),
      getTranslations("Community"),
      getFormatter(),
    ]);
  // « ?partager=goal:<id> » : lien « Partager » depuis un objectif ou un niveau
  const preselected =
    typeof params.partager === "string" ? params.partager : null;

  return (
    <div className="flex flex-col gap-5">
      <ProgressStories
        stories={stories}
        name={profile.displayName ?? member.username ?? ""}
        avatarUrl={myAvatar}
        canWrite={!member.suspendedUntil}
        now={feed.loadedAt}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {t("signedInAs", { username: member.username ?? "" })}
        </p>
        {isModerator(member.role) ? (
          <Button asChild variant="outline" size="sm">
            <Link href="/moderation">
              <ShieldCheck aria-hidden="true" />
              {t("moderationLink")}
            </Link>
          </Button>
        ) : null}
      </div>

      {member.suspendedUntil ? (
        <p
          role="status"
          className="flex items-start gap-2 rounded-3xl border border-destructive/40 bg-destructive/10 p-4 text-sm"
        >
          <ShieldAlert
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 text-destructive"
          />
          {t("suspended", {
            date: format.dateTime(member.suspendedUntil, {
              dateStyle: "long",
              timeZone: profile.timeZone,
            }),
          })}
        </p>
      ) : (
        <PostComposer
          shareable={shareable}
          preselected={preselected}
          name={profile.displayName ?? member.username ?? ""}
          avatarUrl={myAvatar}
          mediaEnabled={storageEnabled()}
        />
      )}

      <CommunityFeed
        // Une nouvelle publication (ou une suppression) recharge le fil
        key={feed.posts[0]?.id ?? "empty"}
        initialPosts={feed.posts}
        initialCursor={feed.nextCursor}
        now={feed.loadedAt}
        canWrite={!member.suspendedUntil}
      />
    </div>
  );
}

export function CommunityPanelSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <Skeleton className="h-48 rounded-3xl" />
      <Skeleton className="h-40 rounded-3xl" />
      <Skeleton className="h-40 rounded-3xl" />
    </div>
  );
}
