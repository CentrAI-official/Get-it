import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/layout/page-header";
import {
  GroupEditLoader,
  GroupsSkeleton,
} from "@/features/groups/components/groups-panels";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Groups.form");
  return { title: t("editTitle") };
}

// Modifier un groupe (le créateur et les admins)
export default function EditGroupPage({
  params,
}: PageProps<"/[locale]/groups/[id]/edit">) {
  const t = useTranslations("Groups");

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <BackLink href="/groups" label={t("back")} />
      <PageHeader
        title={t("form.editTitle")}
        description={t("form.editDescription")}
      />
      <Suspense fallback={<GroupsSkeleton />}>
        {params.then(({ id }) => (
          <GroupEditLoader groupId={id} />
        ))}
      </Suspense>
    </div>
  );
}
