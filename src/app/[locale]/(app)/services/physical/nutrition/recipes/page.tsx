import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { DevelopmentSection } from "@/features/development/components/development-section";
import {
  LibraryBrowser,
  LibrarySkeleton,
} from "@/features/library/components/library-browser";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Development.section");
  return { title: t("nutrition.title") };
}

// Physique › Nutrition › Recettes
export default function LibraryPage({
  searchParams,
}: PageProps<"/[locale]/services/physical/nutrition/recipes">) {
  return (
    <DevelopmentSection section="nutrition" current="recipes">
      <Suspense fallback={<LibrarySkeleton />}>
        <LibraryBrowser
          kind="recipe"
          pillar="physical"
          basePath="/services/physical/nutrition/recipes"
          searchParams={searchParams}
        />
      </Suspense>
    </DevelopmentSection>
  );
}
