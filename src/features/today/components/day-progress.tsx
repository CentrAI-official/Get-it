import { useTranslations } from "next-intl";
import { Progress } from "@/components/ui/progress";

/** « Ta journée : 3 sur 5 actions », avec une barre d'avancement. */
export function DayProgress({ done, total }: { done: number; total: number }) {
  const t = useTranslations("Today.progress");
  const message =
    total === 0 ? t("nothing") : done === total ? t("allDone") : null;

  return (
    <section
      aria-labelledby="day-progress"
      className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="day-progress" className="font-heading font-semibold">
          {t("title")}
        </h2>
        {total > 0 ? (
          <p className="text-sm text-muted-foreground tabular-nums">
            {t("label", { done, total })}
          </p>
        ) : null}
      </div>
      {total > 0 ? (
        <Progress
          value={Math.round((done / total) * 100)}
          aria-label={t("label", { done, total })}
        />
      ) : null}
      {message ? (
        <p className="text-sm text-muted-foreground">{message}</p>
      ) : null}
    </section>
  );
}
