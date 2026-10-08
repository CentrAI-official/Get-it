import { Plus } from "lucide-react";
import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  HabitsOverview,
  HabitsOverviewSkeleton,
} from "@/features/habits/components/habits-overview";
import { Link } from "@/i18n/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("App.habits");
  return { title: t("title") };
}

export default function HabitsPage() {
  const t = useTranslations();

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={t("App.habits.title")}
        description={t("App.habits.question")}
        action={
          <Button asChild>
            <Link href="/habits/new">
              <Plus aria-hidden="true" />
              {t("Habits.new")}
            </Link>
          </Button>
        }
      />
      <Suspense fallback={<HabitsOverviewSkeleton />}>
        <HabitsOverview />
      </Suspense>
    </div>
  );
}
