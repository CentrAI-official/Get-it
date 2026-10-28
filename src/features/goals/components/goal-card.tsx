import { ChevronRight } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { ProgressRing } from "@/components/progress-ring";
import { Badge } from "@/components/ui/badge";
import { pillarIcons } from "@/config/pillars";
import { Link } from "@/i18n/navigation";
import { toDbDate } from "@/lib/dates";
import type { GoalSummary } from "@/server/goals/service";

/** Carte d'objectif cliquable : anneau d'avancement des jalons (avec la photo choisie), pilier et date cible. */
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
      className="-mx-3 flex h-full items-center gap-4 rounded-2xl px-3 py-4 transition-colors outline-none hover:bg-foreground/[0.04] focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <ProgressRing value={total > 0 ? done / total : 0} className="size-14">
        {goal.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={goal.photoUrl}
            alt=""
            loading="lazy"
            className="size-full rounded-full object-cover"
          />
        ) : (
          <Icon aria-hidden="true" className="size-5 text-silver" />
        )}
      </ProgressRing>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="font-semibold text-pretty break-words">{goal.title}</p>
        <p className="text-sm text-muted-foreground">{details.join(" · ")}</p>
        {total > 0 ? (
          <p className="text-xs text-muted-foreground tabular-nums">
            <span aria-hidden="true">
              {done}/{total}
            </span>
            <span className="sr-only">
              {t("progressLabel", { done, total })}
            </span>
          </p>
        ) : null}
      </div>
      {goal.status !== "active" ? (
        <Badge variant="outline" className="shrink-0">
          {t(`status.${goal.status}`)}
        </Badge>
      ) : (
        <ChevronRight
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground"
        />
      )}
    </Link>
  );
}
