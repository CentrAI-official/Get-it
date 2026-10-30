import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/layout/page-header";
import {
  EventFormSkeleton,
  NewEventLoader,
} from "@/features/events/components/event-panels";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Events");
  return { title: t("newTitle") };
}

export default function NewEventPage({
  searchParams,
}: PageProps<"/[locale]/services/events/new">) {
  const t = useTranslations("Events");

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <BackLink href="/services" label={t("back")} />
      <PageHeader title={t("newTitle")} />
      {/* Le jour choisi dans le calendrier n'est connu qu'à la requête */}
      <Suspense fallback={<EventFormSkeleton />}>
        {searchParams.then(({ day }) => (
          <NewEventLoader day={typeof day === "string" ? day : undefined} />
        ))}
      </Suspense>
    </div>
  );
}
