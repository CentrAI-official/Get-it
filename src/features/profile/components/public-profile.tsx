import { PenLine, Trophy } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PILLARS, pillarIcons } from "@/config/pillars";
import { CommunityFeed } from "@/features/community/components/community-feed";
import { JoinCommunityCard } from "@/features/community/components/join-community-card";
import { Link } from "@/i18n/navigation";
import { listFeed } from "@/server/community/feed";
import { getCommunityMember } from "@/server/community/members";
import { getPublicProfile } from "@/server/profile/public";
import { getCurrentProfile } from "@/server/profile/service";
import { ProfileActions } from "./profile-actions";

/**
 * Profil d'un membre vu par les autres : aperçu public et publications. Lit
 * la session : à placer dans un <Suspense>.
 */
export async function PublicProfileLoader({ username }: { username: string }) {
  const viewer = await getCurrentProfile();
  const member = await getCommunityMember(viewer.id);
  if (!member?.joined) return <JoinCommunityCard />;
  const profile = await getPublicProfile(viewer.id, username);
  if (!profile) notFound();
  const [feed, t, tPillars, format] = await Promise.all([
    listFeed(viewer.id, undefined, profile.id),
    getTranslations("Community.profile"),
    getTranslations("Pillars"),
    getFormatter(),
  ]);
  const name = profile.displayName ?? profile.username;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <Avatar
            name={name}
            url={profile.avatarUrl}
            className="size-20 text-2xl"
          />
          <div className="flex min-w-0 flex-col gap-0.5">
            <h1 className="font-heading text-2xl font-bold tracking-tight break-words">
              {name}
            </h1>
            <p className="text-sm text-muted-foreground">@{profile.username}</p>
          </div>
        </div>
        {profile.bio ? (
          <p className="break-words whitespace-pre-wrap">{profile.bio}</p>
        ) : null}
        {/* Chaque valeur se lit seule (« Niveau 3 », « 2 contacts »…) */}
        <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {/* Le niveau n'est public qu'en mode Ranked */}
          {profile.ranked ? (
            <li className="flex items-center gap-1.5 font-heading font-bold">
              <Trophy aria-hidden="true" className="size-4 text-primary" />
              {t("level", { level: profile.ranked.total })}
              <span className="font-sans text-xs font-medium text-muted-foreground">
                {t("ranked")}
              </span>
            </li>
          ) : (
            <li className="text-muted-foreground">{t("unranked")}</li>
          )}
          <li>{t("contacts", { count: profile.contacts })}</li>
          <li className="text-muted-foreground">
            {t("memberSince", {
              date: format.dateTime(new Date(profile.memberSince), {
                month: "long",
                year: "numeric",
              }),
            })}
          </li>
        </ul>
        {profile.mine ? (
          <Button asChild variant="outline" className="w-fit">
            <Link href="/profile">
              <PenLine aria-hidden="true" />
              {t("edit")}
            </Link>
          </Button>
        ) : (
          <ProfileActions
            userId={profile.id}
            contactState={profile.contactState}
          />
        )}
      </header>

      <section
        aria-labelledby="public-pillars"
        className="flex flex-col gap-4 border-t border-foreground/8 pt-6"
      >
        <h2 id="public-pillars" className="caps-label text-muted-foreground">
          {t("pillars")}
        </h2>
        <ul className="grid grid-cols-4 gap-2">
          {PILLARS.map((pillar) => {
            const Icon = pillarIcons[pillar];
            const focus = profile.focusPillars.includes(pillar);
            return (
              <li
                key={pillar}
                className="flex flex-col items-center gap-1 text-center"
              >
                <span
                  className={
                    focus
                      ? "flex size-12 items-center justify-center rounded-full border border-primary/50 bg-primary/10"
                      : "flex size-12 items-center justify-center rounded-full orb"
                  }
                >
                  <Icon aria-hidden="true" className="size-5 text-silver" />
                </span>
                <span className="text-xs font-semibold">
                  {tPillars(`${pillar}.name`)}
                </span>
                {profile.ranked ? (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {pillar === "physical" || pillar === "financial"
                      ? t("level", { level: profile.ranked[pillar] })
                      : t("private")}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
        {profile.focusPillars.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("focus", {
              pillars: format.list(
                profile.focusPillars.map((pillar) =>
                  tPillars(`${pillar}.name`),
                ),
              ),
            })}
          </p>
        ) : null}
      </section>

      <section
        aria-labelledby="public-posts"
        className="flex flex-col gap-4 border-t border-foreground/8 pt-6"
      >
        <h2 id="public-posts" className="caps-label text-muted-foreground">
          {t("posts")}
        </h2>
        <CommunityFeed
          initialPosts={feed.posts}
          initialCursor={feed.nextCursor}
          now={feed.loadedAt}
          canWrite={!member.suspendedUntil}
          authorId={profile.id}
          empty={{
            title: t("emptyTitle"),
            description: t("emptyDescription", { name }),
          }}
        />
      </section>
    </div>
  );
}

export function PublicProfileSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <Skeleton className="size-20 rounded-full" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
      <Skeleton className="h-4 w-full max-w-sm" />
      <Skeleton className="h-9 w-48 rounded-full" />
    </div>
  );
}
