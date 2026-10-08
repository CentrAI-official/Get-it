import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { getGoal } from "@/server/goals/service";
import { getCurrentProfile } from "@/server/profile/service";
import { updateGoalAction } from "../actions";
import { recordIdSchema } from "../schemas";
import { GoalForm } from "./goal-form";

/** Formulaire prérempli d'un objectif existant. Lit la session : à placer dans un <Suspense>. */
export async function GoalEditForm({ goalId }: { goalId: string }) {
  if (!recordIdSchema.safeParse(goalId).success) notFound();
  const profile = await getCurrentProfile();
  const goal = await getGoal(profile.id, goalId);
  if (!goal) notFound();
  const t = await getTranslations("Goals.form");

  return (
    <GoalForm
      action={updateGoalAction.bind(null, goal.id)}
      defaults={{
        title: goal.title,
        description: goal.description ?? "",
        pillar: goal.pillar,
        targetDate: goal.targetDate ?? "",
      }}
      submitLabel={t("save")}
      pendingLabel={t("saving")}
      cancelHref={`/goals/${goal.id}`}
    />
  );
}
