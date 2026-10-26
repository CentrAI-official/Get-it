import { getFormatter, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { PercentValue } from "@/components/percent-value";
import { ProgressRing } from "@/components/progress-ring";
import { Share2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { pillarIcons } from "@/config/pillars";
import { TaskList } from "@/features/tasks/components/task-list";
import { toCalendarDay, toDbDate } from "@/lib/dates";
import { isAiConfigured } from "@/server/ai/provider";
import { getAiProfile } from "@/server/ai/usage";
import { getGoal } from "@/server/goals/service";
import { getCurrentProfile } from "@/server/profile/service";
import { storageEnabled } from "@/server/storage/service";
import { recordIdSchema } from "../schemas";
import { GoalActions } from "./goal-actions";
import { GoalPhotoEditor } from "./goal-photo-editor";
import { GoalPlanCard } from "./goal-plan-card";
import { MilestoneList } from "./milestone-list";

/** Un objectif : description, avancement, jalons et tâches. Lit la session : à placer dans un <Suspense>. */
export async function GoalDetail({ goalId }: { goalId: string }) {
  if (!recordIdSchema.safeParse(goalId).success) notFound();
  const profile = await getCurrentProfile();
  const goal = await getGoal(profile.id, goalId);
  if (!goal) notFound();

  const [t, tPillars, format, ai] = await Promise.all([
    getTranslations("Goals"),
    getTranslations("Pillars"),
    getFormatter(),
    // Le plan par l'IA : seulement pour un objectif en cours, quand l'IA est activée
    goal.status === "active" && isAiConfigured()
      ? getAiProfile(profile.id)
      : null,
  ]);
  // L'heure courante est lue après la session : jamais pendant le prérendu
  const today = toCalendarDay(new Date(), profile.timeZone);
  const Icon = pillarIcons[goal.pillar];
  const { milestonesDone: done, milestonesTotal: total } = goal;
  const part = total > 0 ? done / total : 0;

  return (
    <article className="flex flex-col gap-6 lg:gap-8">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
        {/* Avancement des jalons, autour de la photo choisie */}
        <div className="relative w-fit">
          <ProgressRing value={part} className="size-24 p-1.5 sm:size-28">
            {goal.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={goal.photoUrl}
                alt=""
                className="size-full rounded-full object-cover"
              />
            ) : (
              <span className="flex flex-col items-center gap-0.5">
                {total > 0 ? (
                  <span className="font-mono text-xl font-bold sm:text-2xl">
                    <PercentValue part={part} />
                  </span>
                ) : (
                  <Icon aria-hidden="true" className="size-7 text-silver" />
                )}
              </span>
            )}
          </ProgressRing>
          <GoalPhotoEditor
            goalId={goal.id}
            photoUrl={goal.photoUrl}
            photosEnabled={storageEnabled()}
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-3">
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
            <h1 className="font-heading text-3xl leading-tight font-bold tracking-tight text-balance break-words sm:text-4xl">
              {goal.title}
            </h1>
            {goal.status !== "active" ? (
              <Badge variant="outline">{t(`status.${goal.status}`)}</Badge>
            ) : null}
          </div>
          {total > 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("progressLabel", { done, total })}
            </p>
          ) : null}
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
          {goal.completedAt ? (
            <Button asChild variant="outline" size="sm" className="w-fit">
              <Link href={`/community?partager=goal:${goal.id}`}>
                <Share2 aria-hidden="true" />
                {t("detail.share")}
              </Link>
            </Button>
          ) : null}
        </div>
      </header>

      {ai ? (
        <GoalPlanCard
          key={goal.id}
          goalId={goal.id}
          access={ai.consented ? "ready" : "consent"}
        />
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <section
          aria-labelledby="goal-milestones"
          className="flex flex-col gap-4 border-t border-white/8 pt-6"
        >
          <div className="flex flex-col gap-1">
            <h2 id="goal-milestones" className="font-heading text-lg font-bold">
              {t("milestones.title")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("milestones.description")}
            </p>
          </div>
          <MilestoneList goalId={goal.id} milestones={goal.milestones} />
        </section>
        <section
          aria-labelledby="goal-tasks"
          className="flex flex-col gap-4 border-t border-white/8 pt-6"
        >
          <div className="flex flex-col gap-1">
            <h2 id="goal-tasks" className="font-heading text-lg font-bold">
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
    <div className="flex flex-col gap-6 lg:gap-8">
      <Skeleton className="h-64 rounded-3xl sm:h-48" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-56 rounded-3xl" />
        <Skeleton className="h-56 rounded-3xl" />
      </div>
    </div>
  );
}
