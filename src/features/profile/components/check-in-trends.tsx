"use client";

import { ChevronRight } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useChartCursor } from "@/components/charts/use-chart-cursor";
import { Button } from "@/components/ui/button";
import {
  CHECK_IN_METRICS,
  type CheckInMetric,
  type CheckInScores,
} from "@/features/today/schemas";
import { Link } from "@/i18n/navigation";
import { toDbDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

type CheckInTrendsProps = {
  /** Un élément par jour, du plus ancien à aujourd'hui ; null sans check-in. */
  days: { day: string; scores: CheckInScores | null }[];
};

/**
 * Évolution des check-ins : une petite tuile par mesure (dernière note, moyenne
 * et courbe des 14 jours), plutôt que quatre couleurs sur un même graphique.
 */
export function CheckInTrends({ days }: CheckInTrendsProps) {
  const t = useTranslations("Progress.checkIns");
  const tCheckIn = useTranslations("Today.checkIn");
  const format = useFormatter();
  const done = days.filter((item) => item.scores !== null);

  const dateLabel = (day: string) =>
    format.dateTime(toDbDate(day), {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });

  return (
    <section
      aria-labelledby="check-in-trends-title"
      className="flex flex-col gap-4 rounded-3xl glass p-5"
    >
      <div className="flex flex-col gap-1">
        <h3 id="check-in-trends-title" className="font-heading font-bold">
          {t("title")}
        </h3>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      {done.length === 0 ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
          <Button asChild variant="outline" size="sm">
            <Link href="/profile#check-in">{t("emptyCta")}</Link>
          </Button>
        </div>
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-3">
            {CHECK_IN_METRICS.map((metric) => (
              <li key={metric}>
                <MetricTile metric={metric} days={days} dateLabel={dateLabel} />
              </li>
            ))}
          </ul>

          <details className="group text-sm">
            <summary className="flex w-fit cursor-pointer list-none items-center gap-1 rounded-md text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
              <ChevronRight
                aria-hidden="true"
                className="size-4 transition-transform group-open:rotate-90"
              />
              {t("table")}
            </summary>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-left">
                <thead className="text-xs text-muted-foreground">
                  <tr>
                    <th scope="col" className="py-1 pr-2 font-medium">
                      {t("colDay")}
                    </th>
                    {CHECK_IN_METRICS.map((metric) => (
                      <th
                        key={metric}
                        scope="col"
                        className="px-1 py-1 text-right font-medium"
                      >
                        {tCheckIn(`metrics.${metric}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {done.map((item) => (
                    <tr key={item.day} className="border-t border-white/5">
                      <td className="py-1 pr-2 whitespace-nowrap">
                        {dateLabel(item.day)}
                      </td>
                      {CHECK_IN_METRICS.map((metric) => (
                        <td
                          key={metric}
                          className="px-1 py-1 text-right tabular-nums"
                        >
                          {item.scores?.[metric]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </section>
  );
}

// Courbe : 14 colonnes de 10 unités, notes de 1 (bas) à 5 (haut)
const SLOT = 10;
const HEIGHT = 40;
const PAD = 4;
const toY = (score: number) => PAD + ((5 - score) / 4) * (HEIGHT - PAD * 2);

type MetricTileProps = {
  metric: CheckInMetric;
  days: CheckInTrendsProps["days"];
  dateLabel: (day: string) => string;
};

function MetricTile({ metric, days, dateLabel }: MetricTileProps) {
  const t = useTranslations("Progress.checkIns");
  const tCheckIn = useTranslations("Today.checkIn");
  const format = useFormatter();
  const { active, containerProps, slotProps } = useChartCursor(days.length);
  const width = days.length * SLOT;
  const name = tCheckIn(`metrics.${metric}`);

  const points = days.map((item, index) => ({
    x: index * SLOT + SLOT / 2,
    score: item.scores?.[metric] ?? null,
  }));
  const values = points.flatMap((point) =>
    point.score === null ? [] : [point.score],
  );
  const latest = [...points].reverse().find((point) => point.score !== null);
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  // Un jour sans check-in coupe la courbe
  const path = points
    .map((point, index) => {
      if (point.score === null) return "";
      const previous = points[index - 1];
      const command = previous && previous.score !== null ? "L" : "M";
      return `${command}${point.x},${toY(point.score)}`;
    })
    .join(" ");
  const activeDay = active === null ? null : days[active];
  const activeScore = activeDay?.scores?.[metric] ?? null;

  return (
    <div className="flex h-full flex-col gap-2 rounded-2xl border border-white/8 bg-white/[0.035] p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{name}</span>
        <span className="font-heading text-lg font-bold">
          {latest?.score ? tCheckIn("score", { score: latest.score }) : "—"}
        </span>
      </div>

      <div
        role="group"
        aria-label={t("chartLabel", { metric: name })}
        {...containerProps}
        className="relative h-12 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <svg
          viewBox={`0 0 ${width} ${HEIGHT}`}
          preserveAspectRatio="none"
          aria-hidden="true"
          className="absolute inset-0 size-full overflow-visible"
        >
          {/* Repère discret au milieu de l'échelle (3/5) */}
          <line
            x1={0}
            x2={width}
            y1={toY(3)}
            y2={toY(3)}
            stroke="rgb(255 255 255 / 0.08)"
            vectorEffect="non-scaling-stroke"
          />
          {active !== null ? (
            <line
              x1={active * SLOT + SLOT / 2}
              x2={active * SLOT + SLOT / 2}
              y1={0}
              y2={HEIGHT}
              stroke="rgb(255 255 255 / 0.25)"
              vectorEffect="non-scaling-stroke"
            />
          ) : null}
          <path
            d={path}
            fill="none"
            stroke="var(--silver)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {/* Un point par check-in (en HTML : reste rond quelle que soit la largeur) ;
            le jour parcouru ressort */}
        {points.map((point, index) =>
          point.score !== null ? (
            <span
              key={days[index]?.day}
              aria-hidden="true"
              className={cn(
                "absolute -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card",
                index === active ? "size-3 bg-foreground" : "size-2 bg-silver",
              )}
              style={{
                left: `${(point.x / width) * 100}%`,
                top: `${(toY(point.score) / HEIGHT) * 100}%`,
              }}
            />
          ) : null,
        )}
        {/* Zones de survol : une par jour, pleine hauteur */}
        <div className="absolute inset-0 flex">
          {days.map((item, index) => (
            <div
              key={item.day}
              {...slotProps(index)}
              className="h-full flex-1"
            />
          ))}
        </div>
        <p aria-live="polite" className="sr-only">
          {activeDay
            ? activeScore !== null
              ? t("dayValue", {
                  date: dateLabel(activeDay.day),
                  score: activeScore,
                })
              : t("noValue", { date: dateLabel(activeDay.day) })
            : ""}
        </p>
      </div>

      <p aria-hidden="true" className="text-xs text-muted-foreground">
        {activeDay
          ? activeScore !== null
            ? t("dayValue", {
                date: dateLabel(activeDay.day),
                score: activeScore,
              })
            : t("noValue", { date: dateLabel(activeDay.day) })
          : t("average", {
              value: format.number(average, { maximumFractionDigits: 1 }),
            })}
      </p>
    </div>
  );
}
