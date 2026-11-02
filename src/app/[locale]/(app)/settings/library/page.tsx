import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/layout/page-header";
import {
  LibraryAdminPanel,
  LibraryAdminSkeleton,
} from "@/features/library/components/library-admin";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("LibraryAdmin");
  return { title: t("title") };
}

// Réglages › Catalogue de Mon développement : réservé à l'équipe Get iT (rôle admin)
export default function LibraryAdminPage() {
  const t = useTranslations("LibraryAdmin");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <BackLink href="/settings" label={t("back")} />
      <PageHeader title={t("title")} description={t("description")} />
      <Suspense fallback={<LibraryAdminSkeleton />}>
        <LibraryAdminPanel />
      </Suspense>
    </div>
  );
}
