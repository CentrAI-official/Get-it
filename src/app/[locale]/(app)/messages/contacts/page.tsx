import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { ContactsGate } from "@/features/messages/components/messages-panels";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Contacts");
  return { title: t("title") };
}

export default function ContactsPage() {
  const t = useTranslations("Contacts");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <BackLink href="/messages" label={t("back")} />
      <PageHeader title={t("title")} description={t("description")} />
      <Suspense
        fallback={
          <div className="flex flex-col gap-4">
            <Skeleton className="h-32 rounded-3xl" />
            <Skeleton className="h-9 w-72 max-w-full rounded-full" />
            <Skeleton className="h-16 rounded-2xl" />
          </div>
        }
      >
        <ContactsGate />
      </Suspense>
    </div>
  );
}
