import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import {
  LibraryDetail,
  LibraryDetailSkeleton,
} from "@/features/library/components/library-detail";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("App.services");
  return { title: t("title") };
}

// Fiche d'un exercice, d'une recette ou d'un outil du catalogue
export default function LibraryItemPage({
  params,
}: PageProps<"/[locale]/services/library/[id]">) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      {/* L'identifiant n'est connu qu'à la requête : lu dans le Suspense */}
      <Suspense fallback={<LibraryDetailSkeleton />}>
        {params.then(({ id }) => (
          <LibraryDetail id={id} />
        ))}
      </Suspense>
    </div>
  );
}
