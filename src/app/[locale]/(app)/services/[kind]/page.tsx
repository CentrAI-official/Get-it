import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import {
  DevelopmentLoader,
  DevelopmentSkeleton,
} from "@/features/development/components/development-panels";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("App.services");
  return { title: t("title") };
}

export default function DevelopmentPlanPage({
  params,
}: PageProps<"/[locale]/services/[kind]">) {
  const t = useTranslations("App.services");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <BackLink href="/services" label={t("title")} />
      {/* Le type de plan n'est connu qu'à la requête : lu dans le Suspense */}
      <Suspense fallback={<DevelopmentSkeleton />}>
        {params.then(({ kind }) => (
          <DevelopmentLoader kind={kind} />
        ))}
      </Suspense>
    </div>
  );
}
