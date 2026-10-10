import { getTranslations } from "next-intl/server";
import { ProgressRing } from "@/components/progress-ring";
import { Skeleton } from "@/components/ui/skeleton";
import { pillarIcons } from "@/config/pillars";
import {
  ASSESSMENT_LEVELS,
  DAILY_MINUTES_OPTIONS,
} from "@/features/onboarding/schemas";
import {
  getCurrentProfile,
  getLatestAssessments,
} from "@/server/profile/service";

/** Identité, piliers prioritaires et point de départ. Lit la session : à placer dans un <Suspense>. */
export async function ProfileOverview() {
  const profile = await getCurrentProfile();
  const [assessments, t, tPillars, tOnboarding] = await Promise.all([
    getLatestAssessments(profile.id),
    getTranslations("App.profile"),
    getTranslations("Pillars"),
    getTranslations("Onboarding"),
  ]);
  const name = profile.displayName ?? profile.email ?? "";
  const time = DAILY_MINUTES_OPTIONS.find(
    (option) => option.minutes === profile.dailyMinutes,
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4 rounded-3xl glass p-5 sm:gap-5 sm:p-6">
        <span
          aria-hidden="true"
          className="flex size-16 shrink-0 items-center justify-center rounded-full border border-white/15 orb font-heading text-2xl font-bold uppercase sm:size-20 sm:text-3xl"
        >
          {name.charAt(0)}
        </span>
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

      <div className="grid gap-6 lg:grid-cols-2">
        <section
          aria-labelledby="profile-pillars"
          className="flex flex-col gap-4 rounded-3xl glass p-5 sm:p-6"
        >
          <h2 id="profile-pillars" className="font-heading text-lg font-bold">
            {t("pillarsTitle")}
          </h2>
          <ul className="flex flex-wrap gap-2">
            {profile.focusPillars.map((pillar) => {
              const Icon = pillarIcons[pillar];
              return (
                <li
                  key={pillar}
                  className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-2 text-sm font-medium"
                >
                  <Icon aria-hidden="true" className="size-4 text-silver" />
                  {tPillars(`${pillar}.name`)}
                </li>
              );
            })}
          </ul>
          {time ? (
            <dl className="mt-auto flex items-baseline justify-between gap-4 border-t border-white/5 pt-4 text-sm">
              <dt className="text-muted-foreground">{t("dailyTime")}</dt>
              <dd className="font-mono font-medium">
                {tOnboarding(`time.options.${time.key}`)}
              </dd>
            </dl>
          ) : null}
        </section>

        <section
          aria-labelledby="profile-starting-point"
          className="flex flex-col gap-4 rounded-3xl glass p-5 sm:p-6"
        >
          <div className="flex flex-col gap-1">
            <h2
              id="profile-starting-point"
              className="font-heading text-lg font-bold"
            >
              {t("startingPointTitle")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("startingPointDescription")}
            </p>
          </div>
          {/* Une bulle par pilier, l'anneau rempli selon la note sur 5 */}
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
            {assessments.map(({ pillar, score }) => {
              const level = ASSESSMENT_LEVELS.find(
                (item) => item.score === score,
              );
              return (
                <li
                  key={pillar}
                  className="flex flex-col items-center gap-2 text-center"
                >
                  <ProgressRing value={score / 5} className="size-16 p-1">
                    <span className="font-mono text-sm font-bold">
                      {t("score", { score })}
                    </span>
                  </ProgressRing>
                  <span className="flex flex-col">
                    <span className="text-sm font-semibold">
                      {tPillars(`${pillar}.name`)}
                    </span>
                    {level ? (
                      <span className="text-xs text-muted-foreground">
                        {tOnboarding(`situation.levels.${level.key}`)}
                      </span>
                    ) : null}
                    <span className="sr-only">{t("score", { score })}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}

export function ProfileOverviewSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-[112px] rounded-3xl" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-56 rounded-3xl" />
        <Skeleton className="h-56 rounded-3xl" />
      </div>
    </div>
  );
}
