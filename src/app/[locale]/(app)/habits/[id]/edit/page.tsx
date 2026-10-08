import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { EditHabitForm } from "@/features/habits/components/habit-form-loaders";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Habits.form");
  return { title: t("editTitle") };
}

export default function EditHabitPage({
  params,
}: PageProps<"/[locale]/habits/[id]/edit">) {
  const t = useTranslations("Habits");

  return (
    <div className="flex flex-col gap-8">
      <BackLink href="/habits" label={t("backToList")} />
      <PageHeader
        title={t("form.editTitle")}
        description={t("form.editDescription")}
      />
      {/* L'id n'est connu qu'à la requête : lu dans le Suspense */}
      <Suspense fallback={<Skeleton className="h-96 max-w-2xl rounded-xl" />}>
        {params.then(({ id }) => (
          <EditHabitForm habitId={id} />
        ))}
      </Suspense>
    </div>
  );
}
