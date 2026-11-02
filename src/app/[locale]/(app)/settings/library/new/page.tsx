import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/layout/page-header";
import {
  LibraryAdminSkeleton,
  LibraryNewPanel,
} from "@/features/library/components/library-admin";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("LibraryAdmin");
  return { title: t("title") };
}

// Nouvelle fiche du catalogue (?kind=exercise | recipe | tool)
export default function LibraryNewPage({
  searchParams,
}: PageProps<"/[locale]/settings/library/new">) {
  const t = useTranslations("LibraryAdmin");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <BackLink href="/settings/library" label={t("title")} />
      <PageHeader title={t("newTitle")} />
      <Suspense fallback={<LibraryAdminSkeleton />}>
        {searchParams.then(({ kind }) => (
          <LibraryNewPanel kind={typeof kind === "string" ? kind : ""} />
        ))}
      </Suspense>
    </div>
  );
}
