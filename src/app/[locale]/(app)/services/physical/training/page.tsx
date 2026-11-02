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
  return { title: t("training.title") };
}

// Physique › Entraînement › Mon plan : le plan d'entraînement
export default function PlanPage() {
  return (
    <DevelopmentSection section="training" current="plan">
      <Suspense fallback={<DevelopmentSkeleton />}>
        <DevelopmentLoader kind="physical" />
      </Suspense>
    </DevelopmentSection>
  );
}
