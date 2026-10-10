import { ChevronRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { listGoals } from "@/server/goals/service";
import { getCurrentProfile } from "@/server/profile/service";
import { GoalList } from "./goal-list";
import { NoGoals } from "./no-goals";

/** Tous les objectifs, par statut. Lit la session : à placer dans un <Suspense>. */
export async function GoalsOverview() {
  const profile = await getCurrentProfile();
  const [goals, t] = await Promise.all([
    listGoals(profile.id),
    getTranslations("Goals"),
  ]);
  if (goals.length === 0) return <NoGoals />;

  const active = goals.filter((goal) => goal.status === "active");
  const completed = goals.filter((goal) => goal.status === "completed");
  const archived = goals.filter((goal) => goal.status === "archived");

  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="goals-active" className="flex flex-col gap-4">
        <h2 id="goals-active" className="font-heading text-lg font-bold">
          {t("sections.active")}
        </h2>
        {active.length > 0 ? (
          <GoalList goals={active} />
        ) : (
          <p className="text-sm text-muted-foreground">{t("noActive")}</p>
        )}
      </section>

      {completed.length > 0 ? (
        <section
          aria-labelledby="goals-completed"
          className="flex flex-col gap-4"
        >
          <h2 id="goals-completed" className="font-heading text-lg font-bold">
            {t("sections.completed")}
          </h2>
          <GoalList goals={completed} />
        </section>
      ) : null}

      {archived.length > 0 ? (
        <details className="group flex flex-col gap-4">
          <summary className="flex w-fit cursor-pointer list-none items-center gap-2 rounded-md font-heading text-lg font-bold outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
            <ChevronRight
              aria-hidden="true"
              className="size-4 text-muted-foreground transition-transform group-open:rotate-90"
            />
            {t("sections.archived", { count: archived.length })}
          </summary>
          <div className="mt-4">
            <GoalList goals={archived} />
          </div>
        </details>
      ) : null}
    </div>
  );
}
