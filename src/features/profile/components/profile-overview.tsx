import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { Avatar } from "@/components/avatar";
import { ProgressRing } from "@/components/progress-ring";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { levelFromXp } from "@/features/xp/rules";
import { Link } from "@/i18n/navigation";
import { getCommunityMember } from "@/server/community/members";
import { avatarUrl } from "@/server/profile/avatar";
import { countContacts } from "@/server/profile/public";
import { getCurrentProfile } from "@/server/profile/service";
import { storageEnabled } from "@/server/storage/service";
import { getXpTotals } from "@/server/xp/service";
import { ProfileEditor } from "./profile-editor";

/**
 * Identité et niveau, puis la progression (passée en `progression`). Lit la
 * session : à placer dans un <Suspense>.
 */
export async function ProfileOverview({
  progression,
}: {
  progression: ReactNode;
}) {
  const profile = await getCurrentProfile();
  const [xp, photo, contacts, member, t, tXp, tOnboarding] = await Promise.all([
    getXpTotals(profile.id),
    avatarUrl(profile.avatarPath),
    countContacts(profile.id),
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
      <div className="flex flex-col gap-5 border-t border-white/8 pt-6">
        <div className="flex items-center gap-4 sm:gap-5">
          {/* L'anneau autour de la photo (ou de l'initiale) avance avec le niveau */}
          <ProgressRing
            value={level.progress}
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
              {t("contacts", { count: contacts })} ·{" "}
              {t("memberSince", { date: profile.createdAt })}
            </p>
          </div>
        </div>
        {profile.bio ? (
          <p className="break-words whitespace-pre-wrap">{profile.bio}</p>
        ) : null}
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
        {/* Niveau global et chemin vers le suivant */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="flex items-baseline gap-3">
              <span className="font-heading text-xl font-bold">
                {tXp("level", { level: level.level })}
              </span>
              <span className="font-mono text-sm font-bold text-primary">
                {tXp("xp", { xp: xp.total })}
              </span>
            </p>
            <p className="text-sm text-muted-foreground">
              {tXp("toLevelLabel", { xp: left, level: level.level + 1 })}
            </p>
          </div>
          <Progress
            value={Math.round(level.progress * 100)}
            aria-label={tXp("toLevelLabel", {
              xp: left,
              level: level.level + 1,
            })}
          />
        </div>
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
