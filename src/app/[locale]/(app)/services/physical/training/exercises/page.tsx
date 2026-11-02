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
  return { title: t("training.title") };
}

// Physique › Entraînement › Exercices
export default function LibraryPage({
  searchParams,
}: PageProps<"/[locale]/services/physical/training/exercises">) {
  return (
    <DevelopmentSection section="training" current="exercises">
      <Suspense fallback={<LibrarySkeleton />}>
        <LibraryBrowser
          kind="exercise"
          pillar="physical"
          basePath="/services/physical/training/exercises"
          searchParams={searchParams}
        />
      </Suspense>
    </DevelopmentSection>
  );
}
