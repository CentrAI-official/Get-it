import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/layout/page-header";
import {
  EditEventLoader,
  EventFormSkeleton,
} from "@/features/events/components/event-panels";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Events");
  return { title: t("editTitle") };
}

export default function EditEventPage({
  params,
}: PageProps<"/[locale]/services/events/[id]">) {
  const t = useTranslations("Events");

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <BackLink href="/services" label={t("back")} />
      <PageHeader title={t("editTitle")} />
      <Suspense fallback={<EventFormSkeleton />}>
        {params.then(({ id }) => (
          <EditEventLoader id={id} />
        ))}
      </Suspense>
    </div>
  );
}
