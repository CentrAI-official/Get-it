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
  return { title: t("mental.title") };
}

// Mental › Outils
export default function LibraryPage({
  searchParams,
}: PageProps<"/[locale]/services/mental/tools">) {
  return (
    <DevelopmentSection section="mental" current="tools">
      <Suspense fallback={<LibrarySkeleton />}>
        <LibraryBrowser
          kind="tool"
          pillar="mental"
          basePath="/services/mental/tools"
          searchParams={searchParams}
        />
      </Suspense>
    </DevelopmentSection>
  );
}
