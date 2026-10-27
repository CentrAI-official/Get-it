import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/layout/page-header";
import { GroupForm } from "@/features/groups/components/group-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Groups.form");
  return { title: t("newTitle") };
}

// Nouveau groupe : nom, description, sujet et type
export default function NewGroupPage() {
  const t = useTranslations("Groups");

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <BackLink href="/groups" label={t("back")} />
      <PageHeader
        title={t("form.newTitle")}
        description={t("form.newDescription")}
      />
      <GroupForm />
    </div>
  );
}
