import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { recordIdSchema } from "@/features/goals/schemas";
import { listActiveGoals } from "@/server/goals/service";
import { getHabit } from "@/server/habits/service";
import { getCurrentProfile } from "@/server/profile/service";
import { createHabitAction, updateHabitAction } from "../actions";
import { HabitForm } from "./habit-form";
import { HabitManage } from "./habit-manage";

// Les formulaires proposent les objectifs en cours de l'utilisateur :
// ils lisent la session et se placent dans un <Suspense>.

export async function NewHabitForm() {
  const profile = await getCurrentProfile();
  const [goals, t] = await Promise.all([
    listActiveGoals(profile.id),
    getTranslations("Habits.form"),
  ]);

  return (
    <HabitForm
      action={createHabitAction}
      goals={goals.map(({ id, title }) => ({ id, title }))}
      submitLabel={t("create")}
      pendingLabel={t("creating")}
      cancelHref="/habits"
    />
  );
}

export async function EditHabitForm({ habitId }: { habitId: string }) {
  if (!recordIdSchema.safeParse(habitId).success) notFound();
  const profile = await getCurrentProfile();
  const [habit, goals, t] = await Promise.all([
    getHabit(profile.id, habitId),
    listActiveGoals(profile.id),
    getTranslations("Habits"),
  ]);
  if (!habit) notFound();

  // L'objectif lié reste proposé même s'il n'est plus en cours
  const options = goals.map(({ id, title }) => ({ id, title }));
  if (habit.goal && !options.some((goal) => goal.id === habit.goal?.id)) {
    options.push(habit.goal);
  }

  return (
    <div className="flex flex-col gap-10">
      <HabitForm
        action={updateHabitAction.bind(null, habit.id)}
        goals={options}
        defaults={{
          title: habit.title,
          pillar: habit.pillar,
          weekdays: habit.weekdays,
          goalId: habit.goal?.id ?? "",
        }}
        submitLabel={t("form.save")}
        pendingLabel={t("form.saving")}
        cancelHref="/habits"
      />
      <section
        aria-labelledby="habit-manage"
        className="flex max-w-2xl flex-col gap-3 border-t pt-6"
      >
        <h2 id="habit-manage" className="font-heading font-semibold">
          {t("manage.title")}
        </h2>
        <HabitManage habitId={habit.id} archived={habit.archived} />
      </section>
    </div>
  );
}
