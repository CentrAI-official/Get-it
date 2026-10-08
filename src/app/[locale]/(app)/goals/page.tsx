import { Plus } from "lucide-react";
import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { GoalListSkeleton } from "@/features/goals/components/goal-list";
import { GoalsOverview } from "@/features/goals/components/goals-overview";
import { Link } from "@/i18n/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("App.goals");
  return { title: t("title") };
}

export default function GoalsPage() {
  const t = useTranslations();

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={t("App.goals.title")}
        description={t("App.goals.question")}
        action={
          <Button asChild>
            <Link href="/goals/new">
              <Plus aria-hidden="true" />
              {t("Goals.new")}
            </Link>
          </Button>
        }
      />
      <Suspense fallback={<GoalListSkeleton />}>
        <GoalsOverview />
      </Suspense>
    </div>
  );
}
