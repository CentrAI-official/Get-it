import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import {
  EventDetailSkeleton,
  EventDetailView,
} from "@/features/community-events/components/event-detail";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("App.events");
  return { title: t("title") };
}

// Un événement de la Communauté
export default function CommunityEventPage({
  params,
}: PageProps<"/[locale]/events/[id]">) {
  const t = useTranslations("CommunityEvents");

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <BackLink href="/events" label={t("back")} />
      {/* L'identifiant n'est connu qu'à la requête */}
      <Suspense fallback={<EventDetailSkeleton />}>
        {params.then(({ id }) => (
          <EventDetailView eventId={id} />
        ))}
      </Suspense>
    </div>
  );
}
