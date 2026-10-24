import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import {
  PublicProfileLoader,
  PublicProfileSkeleton,
} from "@/features/profile/components/public-profile";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("App.community");
  return { title: t("title") };
}

// Profil d'un membre du Centre : aperçu public et publications
export default function MemberProfilePage({
  params,
}: PageProps<"/[locale]/community/members/[username]">) {
  const t = useTranslations("Community.profile");

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <BackLink href="/community" label={t("back")} />
      {/* Le nom n'est connu qu'à la requête : lu dans le Suspense */}
      <Suspense fallback={<PublicProfileSkeleton />}>
        {params.then(({ username }) => (
          <PublicProfileLoader username={decodeURIComponent(username)} />
        ))}
      </Suspense>
    </div>
  );
}
