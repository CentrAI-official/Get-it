import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import {
  ClientFileView,
  ClientsSkeleton,
} from "@/features/clients/components/clients-views";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Clients.file");
  return { title: t("title") };
}

// La fiche d'un client (mode page) : ses plans partagés et les notes du pro
export default function ClientFilePage({
  params,
}: PageProps<"/[locale]/clients/[id]">) {
  const t = useTranslations("Clients");
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <BackLink href="/clients" label={t("title")} />
      {/* L'id n'est connu qu'à la requête : lu dans le Suspense */}
      <Suspense fallback={<ClientsSkeleton />}>
        {params.then(({ id }) => (
          <ClientFileView clientId={id} />
        ))}
      </Suspense>
    </div>
  );
}
