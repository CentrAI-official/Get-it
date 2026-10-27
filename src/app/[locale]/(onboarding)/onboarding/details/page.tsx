import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { APP_HOME_PATH, ONBOARDING_PATH } from "@/features/auth/access";
import { ProfileDetailsForm } from "@/features/profile/components/profile-details-form";
import { redirect } from "@/i18n/navigation";
import { toCalendarDay } from "@/lib/dates";
import { getProfileDetails } from "@/server/profile/details";
import { getCurrentProfile } from "@/server/profile/service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Details.complete");
  return { title: t("metaTitle") };
}

// Comptes créés avant les renseignements du compte : demandés une seule fois
export default function ProfileDetailsPage() {
  return (
    <Suspense fallback={<DetailsSkeleton />}>
      <DetailsGate />
    </Suspense>
  );
}

async function DetailsGate() {
  const profile = await getCurrentProfile();
  const locale = await getLocale();
  if (!profile.onboardedAt) redirect({ href: ONBOARDING_PATH, locale });
  if (profile.detailsComplete) redirect({ href: APP_HOME_PATH, locale });
  const [details, t] = await Promise.all([
    getProfileDetails(profile.id),
    getTranslations("Details.complete"),
  ]);
  // L'heure courante est lue après la session : jamais pendant le prérendu
  const today = toCalendarDay(new Date(), profile.timeZone);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-3xl leading-tight font-bold tracking-tight text-balance sm:text-4xl">
          {t("title")}
        </h1>
        <p className="text-pretty text-muted-foreground">{t("description")}</p>
      </div>
      <ProfileDetailsForm initial={details} today={today} mode="complete" />
    </div>
  );
}

function DetailsSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-64 max-w-full" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>
      <Skeleton className="h-72 w-full rounded-xl" />
    </div>
  );
}
