import { Users } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/avatar";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { JoinCommunityCard } from "@/features/community/components/join-community-card";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { getCommunityMember } from "@/server/community/members";
import { followCounts, listFollows } from "@/server/follows/service";
import { getPublicProfile } from "@/server/profile/public";
import { getCurrentProfile } from "@/server/profile/service";
import type { FollowList } from "../rules";
import { FollowButton } from "./follow-button";

/**
 * Abonnés ou abonnements d'un membre (visibles par les membres du Centre,
 * personnes bloquées exclues). Lit la session : à placer dans un <Suspense>.
 */
export async function FollowListLoader({
  username,
  list,
}: {
  username: string;
  list: FollowList;
}) {
  const viewer = await getCurrentProfile();
  const member = await getCommunityMember(viewer.id);
  if (!member?.joined) return <JoinCommunityCard />;
  const profile = await getPublicProfile(viewer.id, username);
  if (!profile) notFound();
  const [people, counts, t] = await Promise.all([
    listFollows(viewer.id, profile.id, list),
    followCounts(viewer.id, profile.id),
    getTranslations("Follows"),
  ]);
  const name = profile.displayName ?? profile.username;
  const tab =
    "flex-1 rounded-full border px-3 py-1.5 text-center text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-xl font-bold break-words">{name}</h1>
        <p className="text-sm text-muted-foreground">@{profile.username}</p>
      </div>
      <nav aria-label={t("listsLabel")} className="flex gap-2">
        {(["followers", "following"] as const).map((value) => (
          <Link
            key={value}
            href={`/community/members/${profile.username}/${value}`}
            transitionTypes={["nav-tab"]}
            aria-current={list === value ? "page" : undefined}
            className={cn(
              tab,
              list === value
                ? "border-primary bg-primary/15 text-foreground"
                : "border-foreground/10 bg-foreground/[0.03] text-muted-foreground hover:text-foreground",
            )}
          >
            {value === "followers"
              ? t("followers", { count: counts.followers })
              : t("followingCount", { count: counts.following })}
          </Link>
        ))}
      </nav>
      {people.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t(`${list}Empty`)}
          description={t(
            profile.mine ? `${list}EmptyMine` : `${list}EmptyOther`,
            { name },
          )}
        />
      ) : (
        <ul className="flex flex-col">
          {people.map((person) => {
            const who = person.displayName ?? person.username;
            return (
              <li
                key={person.id}
                className="flex items-center gap-3 border-b border-foreground/8 py-3"
              >
                <Link
                  href={`/community/members/${person.username}`}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <Avatar
                    name={who}
                    url={person.avatarUrl}
                    className="size-11"
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-semibold">{who}</span>
                    <span className="truncate text-sm text-muted-foreground">
                      @{person.username}
                    </span>
                  </span>
                </Link>
                {person.mine ? null : (
                  <FollowButton
                    userId={person.id}
                    name={who}
                    following={person.following}
                    size="sm"
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function FollowListSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-9 w-full rounded-full" />
      {[0, 1, 2, 3].map((row) => (
        <Skeleton key={row} className="h-14 w-full" />
      ))}
    </div>
  );
}
