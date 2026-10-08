import { useFormatter, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { pillarIcons } from "@/config/pillars";
import { Link } from "@/i18n/navigation";
import { toDbDate } from "@/lib/dates";
import type { GoalSummary } from "@/server/goals/service";

/** Carte d'objectif cliquable : pilier, date cible et avancement des jalons. */
export function GoalCard({ goal }: { goal: GoalSummary }) {
  const t = useTranslations("Goals");
  const tPillars = useTranslations("Pillars");
  const format = useFormatter();
  const Icon = pillarIcons[goal.pillar];
  const { milestonesDone: done, milestonesTotal: total } = goal;
  const details = [
    tPillars(`${goal.pillar}.name`),
    goal.targetDate
      ? t("targetDate", {
          // Jour du calendrier : formaté en UTC pour ne pas glisser d'un jour
          date: format.dateTime(toDbDate(goal.targetDate), {
            dateStyle: "medium",
            timeZone: "UTC",
          }),
        })
      : null,
  ].filter(Boolean);

  return (
    <Link
      href={`/goals/${goal.id}`}
      className="flex h-full flex-col gap-4 rounded-xl border bg-card p-4 transition-colors outline-none hover:border-foreground/20 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <div className="flex items-start gap-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-silver">
          <Icon aria-hidden="true" className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-pretty break-words">{goal.title}</p>
          <p className="text-sm text-muted-foreground">{details.join(" · ")}</p>
        </div>
        {goal.status !== "active" ? (
          <Badge variant="outline">{t(`status.${goal.status}`)}</Badge>
        ) : null}
      </div>
      {total > 0 ? (
        <div className="mt-auto flex items-center gap-3">
          <Progress
            value={Math.round((done / total) * 100)}
            aria-label={t("progressLabel", { done, total })}
            className="flex-1"
          />
          <span
            aria-hidden="true"
            className="text-xs text-muted-foreground tabular-nums"
          >
            {done}/{total}
          </span>
        </div>
      ) : null}
    </Link>
  );
}
