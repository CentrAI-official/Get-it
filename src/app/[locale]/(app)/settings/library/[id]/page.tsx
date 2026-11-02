import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/layout/page-header";
import {
  LibraryAdminSkeleton,
  LibraryEditPanel,
} from "@/features/library/components/library-admin";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("LibraryAdmin");
  return { title: t("title") };
}

// Modifier une fiche du catalogue
export default function LibraryEditPage({
  params,
}: PageProps<"/[locale]/settings/library/[id]">) {
  const t = useTranslations("LibraryAdmin");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <BackLink href="/settings/library" label={t("title")} />
      <PageHeader title={t("editTitle")} />
      <Suspense fallback={<LibraryAdminSkeleton />}>
        {params.then(({ id }) => (
          <LibraryEditPanel id={id} />
        ))}
      </Suspense>
    </div>
  );
}
