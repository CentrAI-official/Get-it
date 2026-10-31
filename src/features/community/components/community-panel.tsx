import { ShieldAlert, ShieldCheck } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { after } from "next/server";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { avatarUrl } from "@/server/profile/avatar";
import { listFeed } from "@/server/community/feed";
import { storageEnabled } from "@/server/storage/service";
import { getCommunityMember, isModerator } from "@/server/community/members";
import { listShareableProgress } from "@/server/community/posts";
import { StoryRow } from "@/features/stories/components/story-row";
import { listStoryRings, purgeExpiredStories } from "@/server/stories/service";
import { getCurrentProfile } from "@/server/profile/service";
import { CommunityFeed } from "./community-feed";
import { JoinCommunityCard } from "./join-community-card";
import { PostComposer } from "./post-composer";

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
  const params = await searchParams;
  // « ?fil=abonnements » : seulement les comptes que je suis et mes groupes
  const following = params.fil === "abonnements";
  const [feed, stories, shareable, myAvatar, t, format] = await Promise.all([
    listFeed(profile.id, undefined, undefined, undefined, following),
    listStoryRings(profile.id, now),
    member.suspendedUntil ? [] : listShareableProgress(profile.id),
    avatarUrl(profile.avatarPath),
    getTranslations("Community"),
    getFormatter(),
  ]);
  // Stories terminées : effacées (avec leurs fichiers) après l'envoi de la page
  after(() =>
    purgeExpiredStories(new Date()).catch((error: unknown) => {
      console.error("Stories terminées non effacées", error);
    }),
  );
  // « ?partager=goal:<id> » : lien « Partager » depuis un objectif ou un niveau
  const preselected =
    typeof params.partager === "string" ? params.partager : null;

  return (
    <div className="flex flex-col gap-5">
      <StoryRow
        mine={stories.mine}
        contacts={stories.contacts}
        name={profile.displayName ?? member.username ?? ""}
        avatarUrl={myAvatar}
        canPost={!member.suspendedUntil && storageEnabled()}
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

      <nav aria-label={t("feedTabs.label")} className="flex gap-2">
        {(["all", "following"] as const).map((value) => {
          const active = (value === "following") === following;
          return (
            <Link
              key={value}
              href={
                value === "following"
                  ? { pathname: "/community", query: { fil: "abonnements" } }
                  : "/community"
              }
              transitionTypes={["nav-tab"]}
              aria-current={active ? "page" : undefined}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                active
                  ? "border-primary bg-primary/15 text-foreground"
                  : "border-foreground/10 bg-foreground/[0.03] text-muted-foreground hover:text-foreground",
              )}
            >
              {t(`feedTabs.${value}`)}
            </Link>
          );
        })}
      </nav>

      <CommunityFeed
        // Une nouvelle publication, une suppression ou l'autre fil recharge la liste
        key={`${following ? "following" : "all"}:${feed.posts[0]?.id ?? "empty"}`}
        initialPosts={feed.posts}
        initialCursor={feed.nextCursor}
        now={feed.loadedAt}
        canWrite={!member.suspendedUntil}
        following={following}
        empty={
          following
            ? {
                title: t("feedTabs.followingEmptyTitle"),
                description: t("feedTabs.followingEmptyDescription"),
              }
            : undefined
        }
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
