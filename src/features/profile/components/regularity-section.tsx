import { Flame, Trophy } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { toDbDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { Regularity } from "../progression";

/** Hauteur d'une semaine de 7 jours actifs, en pixels. */
const FULL_WEEK = 120;

/** « Ta régularité » : jours actifs de cette semaine, des dernières semaines, série et record. */
export async function RegularitySection({
  regularity,
}: {
  regularity: Regularity;
}) {
  const [t, format] = await Promise.all([
    getTranslations("Progress.regularity"),
    getFormatter(),
  ]);
  const { weeks, thisWeek, streak, best } = regularity;
  const first = weeks[0];

  return (
    <section
      aria-labelledby="regularity-title"
      className="flex flex-col gap-6 border-t border-foreground/8 pt-6"
    >
      <div className="flex flex-col gap-1.5">
        <h2 id="regularity-title" className="caps-label text-muted-foreground">
          {t("title")}
        </h2>
        <p className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <span
            aria-hidden="true"
            className="font-display text-6xl leading-none tabular-nums"
          >
            {thisWeek}
            <span className="text-muted-foreground">/7</span>
          </span>
          <span aria-hidden="true" className="font-semibold">
            {t("thisWeek", { count: thisWeek })}
          </span>
          <span className="sr-only">{t("summary", { count: thisWeek })}</span>
        </p>
      </div>

      <figure className="flex flex-col gap-2">
        <div
          role="img"
          aria-label={t("chartLabel", { weeks: weeks.length, count: thisWeek })}
          className="grid h-[150px] items-end gap-2 border-b border-foreground/8"
          style={{
            gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))`,
          }}
        >
          {weeks.map((week) => (
            <div
              key={week.start}
              className="flex h-full flex-col items-center justify-end gap-1.5"
            >
              {week.current ? (
                <span className="text-[13px] font-bold tabular-nums">
                  {week.count}
                </span>
              ) : null}
              <div
                className={cn(
                  "min-h-[3px] w-full max-w-[22px] rounded-t-md bg-primary",
                  !week.current && "opacity-45",
                )}
                style={{ height: `${(week.count / 7) * FULL_WEEK}px` }}
              />
            </div>
          ))}
        </div>
        <figcaption className="flex justify-between gap-4 text-xs text-muted-foreground">
          <span>
            {first
              ? t("firstWeek", {
                  // Jour du calendrier : formaté en UTC pour ne pas glisser d'un jour
                  date: format.dateTime(toDbDate(first.start), {
                    day: "numeric",
                    month: "long",
                    timeZone: "UTC",
                  }),
                })
              : null}
          </span>
          <span>{t("currentWeek")}</span>
        </figcaption>
      </figure>

      <ul className="grid grid-cols-2 gap-3">
        {[
          { key: "streak" as const, value: streak, Icon: Flame, accent: true },
          { key: "best" as const, value: best, Icon: Trophy, accent: false },
        ].map(({ key, value, Icon, accent }) => (
          <li key={key} className="flex items-center gap-2.5">
            <Icon
              aria-hidden="true"
              className={cn(
                "size-[22px] shrink-0",
                accent ? "text-primary" : "text-muted-foreground",
              )}
            />
            <p className="flex flex-col">
              <span className="text-xs text-muted-foreground">{t(key)}</span>
              <span className="text-[17px] font-bold tabular-nums">
                {t("days", { count: value })}
              </span>
            </p>
          </li>
        ))}
      </ul>
      <p className="text-xs text-pretty text-muted-foreground">{t("how")}</p>
    </section>
  );
}
