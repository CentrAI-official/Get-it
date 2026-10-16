import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { ModerationQueue } from "@/features/community/components/moderation-queue";
import { listOpenReports } from "@/server/community/moderation";
import { getCurrentProfile } from "@/server/profile/service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Community.moderation");
  return { title: t("title") };
}

export default function ModerationPage() {
  const t = useTranslations("Community.moderation");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeader title={t("title")} description={t("description")} />
      <Suspense fallback={<Skeleton className="h-64 rounded-3xl" />}>
        <Reports />
      </Suspense>
    </div>
  );
}

/** Réservé aux modérateurs : les autres ne savent même pas que la page existe. */
async function Reports() {
  const profile = await getCurrentProfile();
  const items = await listOpenReports(profile.id);
  if (!items) notFound();
  return <ModerationQueue items={items} />;
}
