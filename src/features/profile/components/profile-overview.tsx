import { ChevronRight, Trophy } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { Avatar } from "@/components/avatar";
import { ProgressRing } from "@/components/progress-ring";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { levelFromXp } from "@/features/xp/rules";
import { Link } from "@/i18n/navigation";
import { getCommunityMember } from "@/server/community/members";
import { followCounts } from "@/server/follows/service";
import { avatarUrl } from "@/server/profile/avatar";
import { countContacts } from "@/server/profile/public";
import { getCurrentProfile } from "@/server/profile/service";
import { getRankedLevels } from "@/server/ranked/service";
import { storageEnabled } from "@/server/storage/service";
import { getXpTotals } from "@/server/xp/service";
import { ProfileEditor } from "./profile-editor";

/**
 * Identité et niveau, « Ma journée » (`day`), puis la progression
 * (`progression`). Lit la session : à placer dans un <Suspense>.
 */
export async function ProfileOverview({
  day,
  progression,
}: {
  day: ReactNode;
  progression: ReactNode;
}) {
  const profile = await getCurrentProfile();
  const [xp, ranked, photo, contacts, follows, member, t, tXp, tOnboarding] =
    await Promise.all([
      getXpTotals(profile.id),
      getRankedLevels(profile.id),
      avatarUrl(profile.avatarPath),
      countContacts(profile.id),
      followCounts(profile.id, profile.id),
      getCommunityMember(profile.id),
      getTranslations("App.profile"),
      getTranslations("Xp"),
      getTranslations("Onboarding"),
    ]);
  const level = levelFromXp(xp.total);
  const left = level.needed - level.current;
  const name = profile.displayName ?? profile.email ?? "";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-5 border-t border-foreground/8 pt-6">
        <div className="flex items-center gap-4 sm:gap-5">
          {/* L'anneau autour de la photo (ou de l'initiale) avance avec le niveau */}
          <ProgressRing
            value={ranked ? ranked.total / 100 : level.progress}
            className="size-20 p-1 sm:size-24"
          >
            <Avatar
              name={name}
              url={photo}
              className="size-full text-2xl sm:text-3xl"
            />
          </ProgressRing>
          <div className="flex min-w-0 flex-col gap-0.5">
            <h2 className="font-heading text-2xl font-bold tracking-tight break-words">
              {name}
            </h2>
            {profile.occupation ? (
              <p className="text-muted-foreground">
                {tOnboarding(`about.occupations.${profile.occupation}`)}
              </p>
            ) : null}
            <p className="text-sm text-muted-foreground">
              {t("memberSince", { date: profile.createdAt })}
            </p>
          </div>
        </div>
        {profile.bio ? (
          <p className="break-words whitespace-pre-wrap">{profile.bio}</p>
        ) : null}
        {/* Contacts = amis ; abonnés = ceux qui suivent ma page ; abonnements = ceux que je suis */}
        <ul className="grid max-w-sm grid-cols-3 gap-2">
          {[
            {
              key: "contacts" as const,
              count: contacts,
              href: "/messages/contacts",
            },
            {
              key: "followers" as const,
              count: follows.followers,
              href: member?.username
                ? `/community/members/${member.username}/followers`
                : null,
            },
            {
              key: "following" as const,
              count: follows.following,
              href: member?.username
                ? `/community/members/${member.username}/following`
                : null,
            },
          ].map(({ key, count, href }) => {
            const body = (
              <>
                <span className="font-heading text-xl font-bold tabular-nums">
                  {count}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t(`counts.${key}`, { count })}
                </span>
              </>
            );
            return (
              <li key={key}>
                {href ? (
                  <Link
                    href={href}
                    className="flex flex-col items-center rounded-2xl py-1 outline-none hover:bg-foreground/[0.04] focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {body}
                  </Link>
                ) : (
                  <span className="flex flex-col items-center py-1">
                    {body}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <ProfileEditor
            name={name}
            avatarUrl={photo}
            bio={profile.bio}
            photosEnabled={storageEnabled()}
          />
          {member?.joined && member.username ? (
            <Link
              href={`/community/members/${member.username}`}
              className="text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {t("viewPublic")}
            </Link>
          ) : null}
        </div>
        {ranked ? (
          // Niveau classé (Canada et États-Unis) : il remplace celui de l'XP
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="flex items-center gap-1.5 font-heading text-xl font-bold">
                <Trophy
                  aria-hidden="true"
                  className="size-5 self-center text-primary"
                />
                {tXp("level", { level: ranked.total })}
              </span>
              <span className="text-sm font-medium text-muted-foreground">
                {t("ranked.badge")}
              </span>
              <span className="text-sm font-bold text-primary tabular-nums">
                {tXp("xp", { xp: xp.total })}
              </span>
            </p>
            <span className="flex items-center gap-4">
              <Link
                href="/profile/ranked/leaderboard"
                className="flex items-center gap-1 rounded-md text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {t("ranked.leaderboard")}
              </Link>
              <Link
                href="/profile/ranked"
                className="flex items-center gap-1 rounded-md text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {t("ranked.view")}
                <ChevronRight aria-hidden="true" className="size-4" />
              </Link>
            </span>
          </div>
        ) : (
          // Niveau de l'XP, chemin vers le suivant, et l'option de passer en Ranked
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <p className="flex items-baseline gap-3">
                <span className="font-heading text-xl font-bold">
                  {tXp("level", { level: level.level })}
                </span>
                <span className="text-sm font-bold text-primary tabular-nums">
                  {tXp("xp", { xp: xp.total })}
                </span>
              </p>
              <Button asChild variant="outline" size="sm">
                <Link href="/profile/ranked">
                  <Trophy aria-hidden="true" className="text-primary" />
                  {t("ranked.go")}
                </Link>
              </Button>
            </div>
            <Progress
              value={Math.round(level.progress * 100)}
              aria-label={tXp("toLevelLabel", {
                xp: left,
                level: level.level + 1,
              })}
            />
            <p className="text-sm text-muted-foreground">
              {tXp("toLevelLabel", { xp: left, level: level.level + 1 })}
            </p>
          </div>
        )}
        {day}
      </div>

      {progression}
    </div>
  );
}

export function ProfileOverviewSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-[188px] rounded-3xl" />
      <Skeleton className="aspect-[322/300] w-full max-w-[380px] self-center rounded-full" />
    </div>
  );
}
