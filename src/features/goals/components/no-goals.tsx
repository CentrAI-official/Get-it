import { Plus, Target } from "lucide-react";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

/** État vide qui invite à créer un premier objectif (§65). */
export function NoGoals() {
  const t = useTranslations();

  return (
    <EmptyState
      icon={Target}
      title={t("App.goals.emptyTitle")}
      description={t("App.goals.emptyDescription")}
      action={
        <Button asChild>
          <Link href="/goals/new">
            <Plus aria-hidden="true" />
            {t("Goals.createFirst")}
          </Link>
        </Button>
      }
    />
  );
}
