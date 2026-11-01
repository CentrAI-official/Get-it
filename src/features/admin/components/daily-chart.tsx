"use client";

import { useFormatter, useTranslations } from "next-intl";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { toDbDate } from "@/lib/dates";

type DailyChartProps = {
  /** Ce que montre le graphique (le titre de sa carte), pour les lecteurs d'écran. */
  title: string;
  /** Un point par jour (« AAAA-MM-JJ »), du plus ancien au plus récent. */
  data: readonly { day: string; value: number }[];
  /** Courbe (évolution) ou colonnes (comptes par jour). */
  kind: "area" | "bar";
};

/**
 * Une série par jour, en orange (seule couleur des détails). Le résumé du
 * graphique (période, maximum) est donné aux lecteurs d'écran.
 */
export function DailyChart({ title, data, kind }: DailyChartProps) {
  const t = useTranslations("Admin.common");
  const format = useFormatter();
  const config = {
    value: { label: title, color: "var(--chart-1)" },
  } satisfies ChartConfig;
  // Jour du calendrier : formaté en UTC pour ne pas glisser d'un jour
  const dayLabel = (day: string) =>
    format.dateTime(toDbDate(day), {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });
  const first = data[0]?.day;
  const last = data.at(-1)?.day;
  const summary =
    first && last
      ? t("chartLabel", {
          title,
          from: dayLabel(first),
          to: dayLabel(last),
          max: Math.max(0, ...data.map((point) => point.value)),
        })
      : title;
  const points = [...data];
  const tooltip = (
    <ChartTooltipContent labelFormatter={(value) => dayLabel(String(value))} />
  );

  return (
    <figure className="min-w-0">
      <ChartContainer
        config={config}
        role="img"
        aria-label={summary}
        className="aspect-auto h-56 w-full"
      >
        {kind === "area" ? (
          <AreaChart data={points} margin={{ top: 8, right: 8, left: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              tickFormatter={dayLabel}
              minTickGap={28}
            />
            <YAxis
              width={36}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <ChartTooltip content={tooltip} />
            <Area
              // Pas d'animation d'entrée : la courbe est là tout de suite
              isAnimationActive={false}
              dataKey="value"
              type="monotone"
              stroke="var(--color-value)"
              strokeWidth={2}
              fill="var(--color-value)"
              fillOpacity={0.15}
            />
          </AreaChart>
        ) : (
          <BarChart data={points} margin={{ top: 8, right: 8, left: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              tickFormatter={dayLabel}
              minTickGap={28}
            />
            <YAxis
              width={36}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <ChartTooltip content={tooltip} />
            <Bar
              isAnimationActive={false}
              dataKey="value"
              fill="var(--color-value)"
              radius={[4, 4, 0, 0]}
              maxBarSize={24}
            />
          </BarChart>
        )}
      </ChartContainer>
    </figure>
  );
}
