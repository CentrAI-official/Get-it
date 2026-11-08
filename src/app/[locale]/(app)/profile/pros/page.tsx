import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/layout/page-header";
import {
  ClientsSkeleton,
  MyPros,
} from "@/features/clients/components/clients-views";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Clients.pros");
  return { title: t("title") };
}

// Mes pros (compte personnel) : ce que chaque page voit, choisi par moi
export default function MyProsPage() {
  const t = useTranslations("Clients.pros");
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <BackLink href="/profile" label={t("back")} />
      <PageHeader title={t("title")} description={t("description")} />
      <Suspense fallback={<ClientsSkeleton />}>
        <MyPros />
      </Suspense>
    </div>
  );
}
