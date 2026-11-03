"use client";

import { useFormatter, useTranslations } from "next-intl";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { toDbDate } from "@/lib/dates";

/**
 * La courbe d'un exercice, en orange (seule couleur des détails). L'axe ne part
 * pas de zéro : ce qu'on veut voir, c'est le progrès d'une séance à l'autre. La
 * liste des dernières séances, juste en dessous, donne les valeurs en texte.
 */
export function ExerciseChart({
  title,
  unit,
  points,
}: {
  /** Ce que montre la courbe, pour les lecteurs d'écran. */
  title: string;
  /** « kg », « lb », « s » ou « rép. ». */
  unit: string;
  /** Un point par jour (« AAAA-MM-JJ »), du plus ancien au plus récent. */
  points: readonly { day: string; value: number }[];
}) {
  const t = useTranslations("Library.history");
  const format = useFormatter();
  const config = {
    value: { label: title, color: "var(--chart-1)" },
  } satisfies ChartConfig;
  const dayLabel = (day: string) =>
    format.dateTime(toDbDate(day), {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });
  const amount = (value: number) =>
    `${format.number(value, { maximumFractionDigits: 2 })} ${unit}`;
  const first = points[0];
  const last = points.at(-1);

  return (
    <figure className="min-w-0">
      <ChartContainer
        config={config}
        role="img"
        aria-label={
          first && last
            ? t("chartLabel", {
                title,
                from: dayLabel(first.day),
                to: dayLabel(last.day),
                first: amount(first.value),
                last: amount(last.value),
              })
            : title
        }
        className="aspect-auto h-48 w-full"
      >
        <LineChart data={[...points]} margin={{ top: 8, right: 12, left: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="day"
            tickLine={false}
            axisLine={false}
            tickFormatter={dayLabel}
            minTickGap={28}
          />
          <YAxis
            width={40}
            tickLine={false}
            axisLine={false}
            domain={["auto", "auto"]}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(value) => dayLabel(String(value))}
                formatter={(value) => (
                  <span className="font-medium tabular-nums">
                    {amount(Number(value))}
                  </span>
                )}
              />
            }
          />
          <Line
            // Pas d'animation d'entrée : la courbe est là tout de suite
            isAnimationActive={false}
            dataKey="value"
            type="linear"
            stroke="var(--color-value)"
            strokeWidth={2}
            dot={{ r: 4, fill: "var(--color-value)", strokeWidth: 0 }}
            activeDot={{ r: 6, strokeWidth: 0 }}
          />
        </LineChart>
      </ChartContainer>
    </figure>
  );
}
