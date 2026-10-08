import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { APP_HOME_PATH } from "@/features/auth/access";
import { OnboardingWizard } from "@/features/onboarding/components/onboarding-wizard";
import { redirect } from "@/i18n/navigation";
import { getCurrentProfile } from "@/server/profile/service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Onboarding");
  return { title: t("metaTitle") };
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<OnboardingSkeleton />}>
      <OnboardingGate />
    </Suspense>
  );
}

/** L'onboarding ne se fait qu'une fois : ensuite, direction l'application. */
async function OnboardingGate() {
  const profile = await getCurrentProfile();
  if (profile.onboardedAt) {
    redirect({ href: APP_HOME_PATH, locale: await getLocale() });
  }
  return <OnboardingWizard />;
}

function OnboardingSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-1 w-full" />
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-64 max-w-full" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>
      <Skeleton className="h-48 w-full rounded-xl" />
    </div>
  );
}
