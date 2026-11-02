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
  return { title: t("social.title") };
}

// Social › Outils
export default function LibraryPage({
  searchParams,
}: PageProps<"/[locale]/services/social/tools">) {
  return (
    <DevelopmentSection section="social" current="tools">
      <Suspense fallback={<LibrarySkeleton />}>
        <LibraryBrowser
          kind="tool"
          pillar="social"
          basePath="/services/social/tools"
          searchParams={searchParams}
        />
      </Suspense>
    </DevelopmentSection>
  );
}
