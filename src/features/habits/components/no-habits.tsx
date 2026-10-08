import { Plus, Repeat } from "lucide-react";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

/** État vide qui invite à créer une première habitude. */
export function NoHabits() {
  const t = useTranslations();

  return (
    <EmptyState
      icon={Repeat}
      title={t("App.habits.emptyTitle")}
      description={t("App.habits.emptyDescription")}
      action={
        <Button asChild>
          <Link href="/habits/new">
            <Plus aria-hidden="true" />
            {t("Habits.createFirst")}
          </Link>
        </Button>
      }
    />
  );
}
