import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import {
  ClientsHome,
  ClientsSkeleton,
} from "@/features/clients/components/clients-views";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Clients");
  return { title: t("title") };
}

// Les clients de la page pro (mode page, à la place de Mon développement)
export default function ClientsPage({
  searchParams,
}: PageProps<"/[locale]/clients">) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <Suspense fallback={<ClientsSkeleton />}>
        <ClientsHome searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
