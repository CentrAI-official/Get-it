import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
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
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      {/* L'id (et le retour : Groupes ou Messagerie) ne sont connus qu'à la requête */}
      <Suspense fallback={<GroupsSkeleton />}>
        {params.then(({ id }) => (
          <GroupPageLoader groupId={id} />
        ))}
      </Suspense>
    </div>
  );
}
