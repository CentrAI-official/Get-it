import { Check, Clock } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { toDbDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { GoalPace } from "../progression";

export type GoalInProgress = {
  id: string;
  title: string;
  targetDate: string | null;
  pace: GoalPace;
};

/**
 * « Tes objectifs en cours » : les jalons faits sur une barre, et un trait à
 * l'endroit où l'objectif devrait en être aujourd'hui (temps écoulé).
 */
export async function GoalsInProgress({
  goals,
}: {
  goals: readonly GoalInProgress[];
}) {
  const [t, format] = await Promise.all([
    getTranslations("Progress.goals"),
    getFormatter(),
  ]);
  const percent = (part: number) => format.number(part, { style: "percent" });
  const compared = goals.some(
    ({ pace }) => pace.progress !== null && pace.elapsed !== null,
  );

  return (
    <section
      aria-labelledby="goals-progress-title"
      className="flex flex-col gap-1.5 border-t border-foreground/8 pt-6"
    >
      <div className="flex items-baseline justify-between gap-4">
        <h2
          id="goals-progress-title"
          className="caps-label text-muted-foreground"
        >
          {t("title")}
        </h2>
        <Link
          href="/goals"
          className="rounded-md text-sm font-semibold text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {t("all")}
        </Link>
      </div>
      {compared ? (
        <p className="mb-1.5 text-sm text-muted-foreground">{t("hint")}</p>
      ) : null}

      {goals.length === 0 ? (
        <div className="mt-2 flex flex-col items-start gap-3 border-t border-foreground/8 pt-4">
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
          <Button asChild variant="outline" size="sm">
            <Link href="/goals/new">{t("create")}</Link>
          </Button>
        </div>
      ) : (
        <ul className="flex flex-col">
          {goals.map(({ id, title, targetDate, pace }) => {
            const late =
              pace.status === "slightlyLate" || pace.status === "late";
            const StatusIcon = late ? Clock : Check;
            return (
              <li key={id} className="border-t border-foreground/8">
                <Link
                  href={`/goals/${id}`}
                  className="-mx-3 flex flex-col gap-2.5 rounded-2xl px-3 py-4 outline-none hover:bg-foreground/[0.04] focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="min-w-0 font-semibold text-pretty break-words">
                      {title}
                    </span>
                    {pace.status ? (
                      <span
                        className={cn(
                          "flex shrink-0 items-center gap-1 text-xs font-semibold",
                          late ? "text-muted-foreground" : "text-primary",
                        )}
                      >
                        <StatusIcon
                          aria-hidden="true"
                          className="size-3.5"
                          strokeWidth={late ? 2 : 2.5}
                        />
                        {t(`status.${pace.status}`)}
                      </span>
                    ) : null}
                  </span>

                  {pace.progress !== null ? (
                    <span
                      role="img"
                      aria-label={
                        pace.elapsed !== null
                          ? t("barLabel", {
                              title,
                              percent: percent(pace.progress),
                              elapsed: percent(pace.elapsed),
                            })
                          : t("barLabelNoDate", {
                              title,
                              percent: percent(pace.progress),
                            })
                      }
                      className="relative block h-3"
                    >
                      <span className="absolute inset-x-0 inset-y-0.5 overflow-hidden rounded-full bg-foreground/10">
                        <span
                          className="block h-full rounded-full bg-primary"
                          style={{
                            width: `${Math.round(pace.progress * 100)}%`,
                          }}
                        />
                      </span>
                      {pace.elapsed !== null ? (
                        <span
                          className="absolute -top-[3px] h-[18px] w-0.5 rounded-sm bg-foreground"
                          style={{
                            left: `calc(${Math.round(pace.elapsed * 100)}% - 1px)`,
                          }}
                        />
                      ) : null}
                    </span>
                  ) : null}

                  <span className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>
                      {pace.progress !== null
                        ? t.rich("done", {
                            percent: percent(pace.progress),
                            strong: (chunks) => (
                              <strong className="text-foreground">
                                {chunks}
                              </strong>
                            ),
                          })
                        : t("noMilestones")}
                    </span>
                    <span className="tabular-nums">
                      {pace.daysLeft === null || !targetDate
                        ? t("noDate")
                        : pace.daysLeft < 0
                          ? t("overdue")
                          : t("daysLeft", {
                              count: pace.daysLeft,
                              // Jour du calendrier : formaté en UTC pour ne pas glisser d'un jour
                              date: format.dateTime(toDbDate(targetDate), {
                                day: "numeric",
                                month: "short",
                                timeZone: "UTC",
                              }),
                            })}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
