import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import {
  DevelopmentHub,
  DevelopmentHubSkeleton,
} from "@/features/development/components/development-panels";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("App.services");
  return { title: t("title") };
}

// Mon développement : plans personnalisés par Get iT AI, puis le suivi par
// des professionnels (à venir)
export default function DevelopmentPage({
  searchParams,
}: PageProps<"/[locale]/services">) {
  const t = useTranslations("App.services");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      {/* Pas de titre visible : la page commence par « Mon calendrier » */}
      <h1 className="sr-only">{t("title")}</h1>
      <Suspense fallback={<DevelopmentHubSkeleton />}>
        {/* Jour à montrer (retour d'un événement ajouté), connu à la requête */}
        {searchParams.then(({ day }) => (
          <DevelopmentHub day={typeof day === "string" ? day : undefined} />
        ))}
      </Suspense>
    </div>
  );
}
