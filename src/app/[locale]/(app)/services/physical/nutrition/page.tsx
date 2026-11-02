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
  return { title: t("nutrition.title") };
}

// Physique › Nutrition › Mon plan : le plan de nutrition, bâti avec les recettes du catalogue
export default function PlanPage() {
  return (
    <DevelopmentSection section="nutrition" current="plan">
      <Suspense fallback={<DevelopmentSkeleton />}>
        <DevelopmentLoader kind="nutrition" />
      </Suspense>
    </DevelopmentSection>
  );
}
