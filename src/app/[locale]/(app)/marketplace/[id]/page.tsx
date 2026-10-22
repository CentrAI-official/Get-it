import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import {
  ListingLoader,
  ListingSkeleton,
} from "@/features/marketplace/components/marketplace-panels";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("App.marketplace.services");
  return { title: t("title") };
}

export default function ListingPage({
  params,
}: PageProps<"/[locale]/marketplace/[id]">) {
  const t = useTranslations("Marketplace.detail");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <BackLink href="/marketplace" label={t("back")} />
      {/* L'id n'est connu qu'à la requête : lu dans le Suspense */}
      <Suspense fallback={<ListingSkeleton />}>
        {params.then(({ id }) => (
          <ListingLoader id={id} />
        ))}
      </Suspense>
    </div>
  );
}
