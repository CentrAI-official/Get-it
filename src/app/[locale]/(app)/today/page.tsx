import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ONBOARDING_PATH } from "@/features/auth/access";
import { ActiveGoals } from "@/features/goals/components/active-goals";
import { GoalListSkeleton } from "@/features/goals/components/goal-list";
import {
  TodayDashboard,
  TodayDashboardSkeleton,
} from "@/features/today/components/today-dashboard";
import { formatDayStamp } from "@/features/today/day-stamp";
import { Link, redirect } from "@/i18n/navigation";
import { toCalendarDay } from "@/lib/dates";
import { getDayPeriod } from "@/lib/day-period";
import { getCurrentProfile } from "@/server/profile/service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("App.today");
  return { title: t("title") };
}

export default function TodayPage() {
  const t = useTranslations("App.today");

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <Suspense fallback={<GreetingSkeleton />}>
        <Greeting />
      </Suspense>

      <Suspense fallback={<TodayDashboardSkeleton />}>
        <TodayDashboard />
      </Suspense>

      <section aria-labelledby="today-goals" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="today-goals" className="font-heading text-lg font-bold">
            {t("goalsTitle")}
          </h2>
          <Link
            href="/goals"
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            {t("goalsLink")}
          </Link>
        </div>
        <Suspense fallback={<GoalListSkeleton />}>
          <ActiveGoals />
        </Suspense>
      </section>
    </div>
  );
}

/** « JEU · 08 OCT » puis « Bonsoir, Max. », selon l'heure dans le fuseau de l'utilisateur. */
async function Greeting() {
  const profile = await getCurrentProfile();
  // Page d'arrivée après la connexion : l'onboarding doit être terminé
  if (!profile.onboardedAt) {
    redirect({ href: ONBOARDING_PATH, locale: await getLocale() });
  }
  const [t, locale] = await Promise.all([
    getTranslations("App.today"),
    getLocale(),
  ]);
  // L'heure courante est lue après la session : jamais pendant le prérendu
  const now = new Date();

  return (
    <header className="flex flex-col gap-1.5">
      <time
        dateTime={toCalendarDay(now, profile.timeZone)}
        className="font-mono text-xs tracking-[0.16em] text-muted-foreground"
      >
        {formatDayStamp(now, locale, profile.timeZone)}
      </time>
      <h1 className="font-heading text-3xl leading-tight font-bold tracking-tight text-balance sm:text-4xl">
        {t("greeting", {
          period: getDayPeriod(now, profile.timeZone),
          name: profile.displayName ?? "",
        })}
      </h1>
      <p className="text-sm text-muted-foreground">{t("question")}</p>
    </header>
  );
}

function GreetingSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-9 w-64 max-w-full sm:h-10" />
      <Skeleton className="h-5 w-56 max-w-full" />
    </div>
  );
}
