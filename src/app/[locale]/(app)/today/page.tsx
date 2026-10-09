import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { ONBOARDING_PATH } from "@/features/auth/access";
import { ActiveGoals } from "@/features/goals/components/active-goals";
import { GoalListSkeleton } from "@/features/goals/components/goal-list";
import {
  TodayDashboard,
  TodayDashboardSkeleton,
} from "@/features/today/components/today-dashboard";
import { Link, redirect } from "@/i18n/navigation";
import { getDayPeriod } from "@/lib/day-period";
import { getCurrentProfile } from "@/server/profile/service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("App.today");
  return { title: t("title") };
}

export default function TodayPage() {
  const t = useTranslations("App.today");

  return (
    <div className="flex flex-col gap-10">
      <Suspense fallback={<GreetingSkeleton />}>
        <Greeting />
      </Suspense>

      <Suspense fallback={<TodayDashboardSkeleton />}>
        <TodayDashboard />
      </Suspense>

      <section aria-labelledby="today-goals" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="today-goals" className="font-heading text-lg font-semibold">
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

/** « Bonjour, Max. » selon l'heure dans le fuseau de l'utilisateur. */
async function Greeting() {
  const profile = await getCurrentProfile();
  // Page d'arrivée après la connexion : l'onboarding doit être terminé
  if (!profile.onboardedAt) {
    redirect({ href: ONBOARDING_PATH, locale: await getLocale() });
  }
  const t = await getTranslations("App.today");
  // L'heure courante est lue après la session : jamais pendant le prérendu
  const period = getDayPeriod(new Date(), profile.timeZone);

  return (
    <PageHeader
      title={t("greeting", { period, name: profile.displayName ?? "" })}
      description={t("question")}
    />
  );
}

function GreetingSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-8 w-64 max-w-full sm:h-9" />
      <Skeleton className="h-5 w-56 max-w-full" />
    </div>
  );
}
