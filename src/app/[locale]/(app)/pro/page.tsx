import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { ProHome, ProSkeleton } from "@/features/pages/components/pro-views";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Pages.home");
  return { title: t("title") };
}

// L'Espace pro : la page de la personne, vue de l'intérieur
export default async function ProPage() {
  const t = await getTranslations("Pages.home");
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <h1 className="sr-only">{t("title")}</h1>
      <Suspense fallback={<ProSkeleton />}>
        <ProHome />
      </Suspense>
    </div>
  );
}
