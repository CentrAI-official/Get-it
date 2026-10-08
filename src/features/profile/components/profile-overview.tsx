import { getTranslations } from "next-intl/server";
import { Progress } from "@/components/ui/progress";
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
      <div className="flex items-center gap-4 rounded-xl border bg-card p-5 sm:p-6">
        <span
          aria-hidden="true"
          className="flex size-14 shrink-0 items-center justify-center rounded-full bg-secondary font-heading text-xl font-semibold text-silver uppercase"
        >
          {name.charAt(0)}
        </span>
        <div className="min-w-0">
          <h2 className="font-heading text-xl font-semibold break-words">
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
          className="flex flex-col gap-4 rounded-xl border bg-card p-5 sm:p-6"
        >
          <h2 id="profile-pillars" className="font-heading font-semibold">
            {t("pillarsTitle")}
          </h2>
          <ul className="flex flex-wrap gap-2">
            {profile.focusPillars.map((pillar) => {
              const Icon = pillarIcons[pillar];
              return (
                <li
                  key={pillar}
                  className="flex items-center gap-2 rounded-lg border bg-background/40 px-3 py-1.5 text-sm font-medium"
                >
                  <Icon aria-hidden="true" className="size-4 text-silver" />
                  {tPillars(`${pillar}.name`)}
                </li>
              );
            })}
          </ul>
          {time ? (
            <dl className="mt-auto flex items-baseline justify-between gap-4 border-t pt-4 text-sm">
              <dt className="text-muted-foreground">{t("dailyTime")}</dt>
              <dd className="font-medium">
                {tOnboarding(`time.options.${time.key}`)}
              </dd>
            </dl>
          ) : null}
        </section>

        <section
          aria-labelledby="profile-starting-point"
          className="flex flex-col gap-4 rounded-xl border bg-card p-5 sm:p-6"
        >
          <div className="flex flex-col gap-1">
            <h2
              id="profile-starting-point"
              className="font-heading font-semibold"
            >
              {t("startingPointTitle")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("startingPointDescription")}
            </p>
          </div>
          <ul className="flex flex-col gap-4">
            {assessments.map(({ pillar, score }) => {
              const Icon = pillarIcons[pillar];
              const level = ASSESSMENT_LEVELS.find(
                (item) => item.score === score,
              );
              return (
                <li key={pillar} className="flex flex-col gap-2">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="flex items-center gap-2 font-medium">
                      <Icon aria-hidden="true" className="size-4 text-silver" />
                      {tPillars(`${pillar}.name`)}
                    </span>
                    <span className="text-muted-foreground">
                      {level
                        ? `${tOnboarding(`situation.levels.${level.key}`)} · `
                        : null}
                      {t("score", { score })}
                    </span>
                  </div>
                  <Progress
                    value={score * 20}
                    aria-label={tPillars(`${pillar}.name`)}
                  />
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
      <Skeleton className="h-[104px] rounded-xl" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    </div>
  );
}
