import { getFormatter, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { pillarIcons } from "@/config/pillars";
import { TaskList } from "@/features/tasks/components/task-list";
import { toCalendarDay, toDbDate } from "@/lib/dates";
import { getGoal } from "@/server/goals/service";
import { getCurrentProfile } from "@/server/profile/service";
import { recordIdSchema } from "../schemas";
import { GoalActions } from "./goal-actions";
import { MilestoneList } from "./milestone-list";

/** Un objectif : description, avancement, jalons et tâches. Lit la session : à placer dans un <Suspense>. */
export async function GoalDetail({ goalId }: { goalId: string }) {
  if (!recordIdSchema.safeParse(goalId).success) notFound();
  const profile = await getCurrentProfile();
  const goal = await getGoal(profile.id, goalId);
  if (!goal) notFound();

  const [t, tPillars, format] = await Promise.all([
    getTranslations("Goals"),
    getTranslations("Pillars"),
    getFormatter(),
  ]);
  // L'heure courante est lue après la session : jamais pendant le prérendu
  const today = toCalendarDay(new Date(), profile.timeZone);
  const Icon = pillarIcons[goal.pillar];
  const { milestonesDone: done, milestonesTotal: total } = goal;

  return (
    <article className="flex flex-col gap-10">
      <header className="flex flex-col gap-4">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          <Icon aria-hidden="true" className="size-4 text-silver" />
          {tPillars(`${goal.pillar}.name`)}
          {goal.targetDate ? (
            <span>
              {"· "}
              {t("targetDate", {
                date: format.dateTime(toDbDate(goal.targetDate), {
                  dateStyle: "long",
                  timeZone: "UTC",
                }),
              })}
            </span>
          ) : null}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-2xl font-semibold tracking-tight break-words sm:text-3xl">
            {goal.title}
          </h1>
          {goal.status !== "active" ? (
            <Badge variant="outline">{t(`status.${goal.status}`)}</Badge>
          ) : null}
        </div>
        {goal.status === "completed" && goal.completedAt ? (
          <p className="text-sm text-muted-foreground">
            {t("detail.completedOn", {
              date: format.dateTime(goal.completedAt, {
                dateStyle: "long",
                timeZone: profile.timeZone,
              }),
            })}
          </p>
        ) : null}
        {goal.description ? (
          <p className="max-w-2xl text-pretty whitespace-pre-line text-muted-foreground">
            {goal.description}
          </p>
        ) : null}
        <GoalActions goalId={goal.id} status={goal.status} />
      </header>

      {total > 0 ? (
        <div className="flex max-w-xl flex-col gap-2">
          <div className="flex items-baseline justify-between gap-4 text-sm">
            <span>{t("progressLabel", { done, total })}</span>
            <span className="text-muted-foreground tabular-nums">
              {format.number(done / total, { style: "percent" })}
            </span>
          </div>
          <Progress
            value={Math.round((done / total) * 100)}
            aria-hidden="true"
          />
        </div>
      ) : null}

      <div className="grid gap-10 lg:grid-cols-2">
        <section
          aria-labelledby="goal-milestones"
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1">
            <h2
              id="goal-milestones"
              className="font-heading text-lg font-semibold"
            >
              {t("milestones.title")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("milestones.description")}
            </p>
          </div>
          <MilestoneList goalId={goal.id} milestones={goal.milestones} />
        </section>
        <section aria-labelledby="goal-tasks" className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 id="goal-tasks" className="font-heading text-lg font-semibold">
              {t("tasks.title")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("tasks.description")}
            </p>
          </div>
          <TaskList goalId={goal.id} tasks={goal.tasks} today={today} />
        </section>
      </div>
    </article>
  );
}

export function GoalDetailSkeleton() {
  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-80 max-w-full" />
        <Skeleton className="h-5 w-96 max-w-full" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-8 w-28" />
        </div>
      </div>
      <div className="grid gap-10 lg:grid-cols-2">
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    </div>
  );
}
