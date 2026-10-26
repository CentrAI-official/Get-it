import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/layout/page-header";
import {
  RankedPanel,
  RankedSkeleton,
} from "@/features/ranked/components/ranked-panel";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Ranked");
  return { title: t("title") };
}

// Profil › Mode Ranked : niveau classé au Canada et aux États-Unis, par âge
export default function RankedPage({
  searchParams,
}: PageProps<"/[locale]/profile/ranked">) {
  const t = useTranslations("Ranked");

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <div className="flex flex-col gap-4">
        <BackLink href="/profile" label={t("back")} />
        <PageHeader title={t("title")} description={t("description")} />
      </div>
      <Suspense fallback={<RankedSkeleton />}>
        <RankedPanel searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
