import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import {
  DevelopmentLoader,
  DevelopmentSkeleton,
} from "@/features/development/components/development-panels";
import { DevelopmentSection } from "@/features/development/components/development-section";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Development.section");
  return { title: t("mental.title") };
}

// Mental › Mon plan
export default function PlanPage() {
  return (
    <DevelopmentSection section="mental" current="plan">
      <Suspense fallback={<DevelopmentSkeleton />}>
        <DevelopmentLoader kind="mental" />
      </Suspense>
    </DevelopmentSection>
  );
}
