import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import {
  PublicPageLoader,
  PublicPageSkeleton,
} from "@/features/pages/components/public-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Pages.public");
  return { title: t("title") };
}

// Une page pro vue par un membre
export default function PublicPagePage({
  params,
}: PageProps<"/[locale]/pages/[handle]">) {
  const t = useTranslations("Pages.public");
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <BackLink href="/marketplace" label={t("back")} />
      <Suspense fallback={<PublicPageSkeleton />}>
        {params.then(({ handle }) => (
          <PublicPageLoader handle={handle} />
        ))}
      </Suspense>
    </div>
  );
}
