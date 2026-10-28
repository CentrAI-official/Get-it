"use client";

import { ChevronRight } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useChartCursor } from "@/components/charts/use-chart-cursor";
import { toDbDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

type XpHistoryChartProps = {
  /** Un élément par jour, du plus ancien à aujourd'hui. */
  days: { day: string; xp: number }[];
};

/**
 * XP gagnée chaque jour : une colonne par jour (une seule série, en orange :
 * c'est de la progression). Détail au survol et au clavier, et en tableau.
 */
export function XpHistoryChart({ days }: XpHistoryChartProps) {
  const t = useTranslations("Progress.xpChart");
  const tXp = useTranslations("Xp");
  const format = useFormatter();
  const { active, containerProps, slotProps } = useChartCursor(days.length);
  const max = Math.max(1, ...days.map((item) => item.xp));
  const total = days.reduce((sum, item) => sum + item.xp, 0);
  const first = days[0];
  const activeDay = active === null ? null : days[active];
  /**
   * Hauteur d'une colonne, en % de la zone du graphique : 65 % au plus, le haut
   * reste libre pour la bulle de détail.
   */
  const barHeight = (xp: number) => (xp > 0 ? Math.max(3, (xp / max) * 65) : 0);

  // Jour du calendrier : formaté en UTC pour ne pas glisser d'un jour
  const dateLabel = (day: string) =>
    format.dateTime(toDbDate(day), {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });

  return (
    <section aria-labelledby="xp-chart-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 id="xp-chart-title" className="font-heading font-bold">
          {t("title")}
        </h3>
        <p className="font-heading text-2xl font-bold">
          {tXp("xp", { xp: total })}
        </p>
      </div>

      {total === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <>
          <div
            role="group"
            aria-label={t("chartLabel")}
            {...containerProps}
            className="relative rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {/* Colonnes : une par jour, 2 px d'air entre elles, 24 px au plus */}
            <div className="flex h-40 items-end gap-0.5 border-b border-foreground/10">
              {days.map((item, index) => (
                <div
                  key={item.day}
                  {...slotProps(index)}
                  className="flex h-full flex-1 items-end justify-center"
                >
                  <div
                    className={cn(
                      "w-full max-w-6 rounded-t-[4px] transition-[filter,background-color]",
                      item.xp > 0 ? "bg-primary" : "bg-foreground/10",
                      active === index && "brightness-125",
                      active === index && item.xp === 0 && "bg-foreground/25",
                    )}
                    // Un jour sans XP garde une marque de 2 px : la cadence reste lisible
                    style={{
                      height: item.xp > 0 ? `${barHeight(item.xp)}%` : "2px",
                    }}
                  />
                </div>
              ))}
            </div>

            {activeDay && active !== null ? (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute z-10 flex flex-col items-center rounded-xl border border-foreground/10 bg-popover px-3 py-1.5 whitespace-nowrap shadow-xl shadow-black/40"
                // Au-dessus de la colonne ; glisse vers l'intérieur aux bords pour ne pas déborder
                style={{
                  left: `${((active + 0.5) / days.length) * 100}%`,
                  bottom: `calc(${barHeight(activeDay.xp)}% + 8px)`,
                  transform: `translateX(-${(active / Math.max(1, days.length - 1)) * 100}%)`,
                }}
              >
                <span className="text-sm font-bold">
                  {tXp("xp", { xp: activeDay.xp })}
                </span>
                <span className="text-xs text-muted-foreground">
                  {dateLabel(activeDay.day)}
                </span>
              </div>
            ) : null}
            {/* Lu au clavier : le jour parcouru */}
            <p aria-live="polite" className="sr-only">
              {activeDay
                ? t("dayValue", {
                    date: dateLabel(activeDay.day),
                    xp: activeDay.xp,
                  })
                : ""}
            </p>
          </div>

          <div
            aria-hidden="true"
            className="flex justify-between text-xs text-muted-foreground"
          >
            <span>{first ? dateLabel(first.day) : null}</span>
            <span>{t("today")}</span>
          </div>

          <details className="group text-sm">
            <summary className="flex w-fit cursor-pointer list-none items-center gap-1 rounded-md text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
              <ChevronRight
                aria-hidden="true"
                className="size-4 transition-transform group-open:rotate-90"
              />
              {t("table")}
            </summary>
            <table className="mt-2 w-full text-left">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="py-1 font-medium">
                    {t("colDay")}
                  </th>
                  <th scope="col" className="py-1 text-right font-medium">
                    {t("colXp")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {days.map((item) => (
                  <tr key={item.day} className="border-t border-foreground/5">
                    <td className="py-1">{dateLabel(item.day)}</td>
                    <td className="py-1 text-right tabular-nums">
                      {format.number(item.xp)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      )}
    </section>
  );
}
