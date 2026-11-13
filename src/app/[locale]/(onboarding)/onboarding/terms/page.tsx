import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { APP_HOME_PATH, ONBOARDING_PATH } from "@/features/auth/access";
import { AcceptTermsForm } from "@/features/legal/components/accept-terms-form";
import { redirect } from "@/i18n/navigation";
import { legalReady } from "@/server/legal/service";
import { getCurrentProfile } from "@/server/profile/service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Legal.accept");
  return { title: t("metaTitle") };
}

// Loi 25 : les membres d'avant la mise en ligne des conditions les acceptent une fois
export default function AcceptTermsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-6">
          <Skeleton className="h-10 w-72 max-w-full" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      }
    >
      <TermsGate />
    </Suspense>
  );
}

async function TermsGate() {
  const profile = await getCurrentProfile();
  const locale = await getLocale();
  if (!profile.onboardedAt) redirect({ href: ONBOARDING_PATH, locale });
  if (!legalReady() || profile.termsAccepted) {
    redirect({ href: APP_HOME_PATH, locale });
  }
  const t = await getTranslations("Legal.accept");
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-4xl leading-[0.95] text-balance break-words uppercase sm:text-5xl">
          {t("title")}
        </h1>
        <p className="text-pretty text-muted-foreground">{t("description")}</p>
      </div>
      <AcceptTermsForm />
    </div>
  );
}
