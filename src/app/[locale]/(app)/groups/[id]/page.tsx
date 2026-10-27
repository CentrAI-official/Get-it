import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import {
  GroupPageLoader,
  GroupsSkeleton,
} from "@/features/groups/components/groups-panels";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("App.groups");
  return { title: t("title") };
}

// Un groupe : forum (public) ou discussion (privé), et ses membres
export default function GroupPage({
  params,
}: PageProps<"/[locale]/groups/[id]">) {
  const t = useTranslations("Groups");

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <BackLink href="/groups" label={t("back")} />
      {/* L'id n'est connu qu'à la requête : lu dans le Suspense */}
      <Suspense fallback={<GroupsSkeleton />}>
        {params.then(({ id }) => (
          <GroupPageLoader groupId={id} />
        ))}
      </Suspense>
    </div>
  );
}
