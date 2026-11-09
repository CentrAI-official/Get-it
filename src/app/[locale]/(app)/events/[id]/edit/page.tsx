import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/layout/page-header";
import {
  CommunityEventFormSkeleton,
  EditCommunityEventLoader,
} from "@/features/community-events/components/event-pages";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("CommunityEvents");
  return { title: t("editTitle") };
}

export default function EditCommunityEventPage({
  params,
}: PageProps<"/[locale]/events/[id]/edit">) {
  const t = useTranslations("CommunityEvents");

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <Suspense fallback={<CommunityEventFormSkeleton />}>
        {params.then(({ id }) => (
          <>
            <BackLink href={`/events/${id}`} label={t("backToEvent")} />
            <PageHeader title={t("editTitle")} />
            <EditCommunityEventLoader id={id} />
          </>
        ))}
      </Suspense>
    </div>
  );
}
