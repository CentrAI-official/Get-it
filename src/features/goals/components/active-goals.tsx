import { Target } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { listActiveGoals } from "@/server/goals/service";
import { getCurrentProfile } from "@/server/profile/service";
import { GoalList } from "./goal-list";

/** Objectifs en cours de l'utilisateur connecté. Lit la session : à placer dans un <Suspense>. */
export async function ActiveGoals() {
  const profile = await getCurrentProfile();
  const [goals, t] = await Promise.all([
    listActiveGoals(profile.id),
    getTranslations("App.goals"),
  ]);

  if (goals.length === 0) {
    return (
      <EmptyState
        icon={Target}
        title={t("emptyTitle")}
        description={t("emptyDescription")}
      />
    );
  }
  return <GoalList goals={goals} />;
}
