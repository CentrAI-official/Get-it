import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/layout/page-header";
import {
  CommunityEventFormSkeleton,
  NewCommunityEventLoader,
} from "@/features/community-events/components/event-pages";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("CommunityEvents");
  return { title: t("newTitle") };
}

export default function NewCommunityEventPage({
  searchParams,
}: PageProps<"/[locale]/events/new">) {
  const t = useTranslations("CommunityEvents");

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <BackLink href="/events" label={t("back")} />
      <PageHeader title={t("newTitle")} description={t("newDescription")} />
      <Suspense fallback={<CommunityEventFormSkeleton />}>
        {/* Depuis un groupe : connu seulement à la requête */}
        {searchParams.then(({ groupe }) => (
          <NewCommunityEventLoader
            groupId={typeof groupe === "string" ? groupe : undefined}
          />
        ))}
      </Suspense>
    </div>
  );
}
