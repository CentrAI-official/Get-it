import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/layout/page-header";
import {
  EventsHome,
  EventsSkeleton,
} from "@/features/community-events/components/events-home";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("App.events");
  return { title: t("title") };
}

// Événements de la Communauté : l'annuaire, du plus proche au plus lointain
export default function EventsPage({
  searchParams,
}: PageProps<"/[locale]/events">) {
  const t = useTranslations("App.events");
  const tNav = useTranslations("App.nav");

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <BackLink href="/community" label={tNav("community")} />
      <PageHeader title={t("title")} description={t("question")} />
      <Suspense fallback={<EventsSkeleton />}>
        <EventsHome searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
