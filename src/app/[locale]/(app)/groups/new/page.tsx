import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { GroupForm } from "@/features/groups/components/group-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Groups.form");
  return { title: t("newTitle") };
}

// Nouveau groupe : nom, description, sujet et type. Depuis la Messagerie
// (`?type=private`), le groupe est privé par défaut et le retour y mène.
export default function NewGroupPage({
  searchParams,
}: PageProps<"/[locale]/groups/new">) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <Suspense fallback={<Skeleton className="h-96 rounded-3xl" />}>
        <NewGroup searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function NewGroup({
  searchParams,
}: {
  searchParams: PageProps<"/[locale]/groups/new">["searchParams"];
}) {
  const [params, t] = await Promise.all([
    searchParams,
    getTranslations("Groups"),
  ]);
  const isPrivate = params.type === "private";
  return (
    <>
      {isPrivate ? (
        <BackLink href="/messages" label={t("backToMessages")} />
      ) : (
        <BackLink href="/groups" label={t("back")} />
      )}
      <PageHeader
        title={t("form.newTitle")}
        description={t("form.newDescription")}
      />
      <GroupForm defaultVisibility={isPrivate ? "private" : "public"} />
    </>
  );
}
