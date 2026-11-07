"use client";

import { useFormatter, useTranslations } from "next-intl";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatMoney } from "../format";

function useMonthLabel() {
  const format = useFormatter();
  return (month: string) =>
    format.dateTime(new Date(`${month}-01T00:00:00Z`), {
      month: "short",
      timeZone: "UTC",
    });
}

/**
 * Ce qui entre et ce qui sort, mois par mois : l'orange pour ce qui sort, le gris
 * pour ce qui entre. Une seule échelle, deux séries nommées dans la légende.
 */
export function CashFlowChart({
  points,
  currency,
  label,
}: {
  points: readonly {
    month: string;
    incomeCents: number;
    spentCents: number;
  }[];
  currency: string;
  label: string;
}) {
  const t = useTranslations("Budget.reports");
  const format = useFormatter();
  const monthLabel = useMonthLabel();
  const config = {
    incomeCents: { label: t("income"), color: "var(--muted-foreground)" },
    spentCents: { label: t("spent"), color: "var(--chart-1)" },
  } satisfies ChartConfig;
  const money = (cents: number) => formatMoney(format, cents, currency);

  return (
    <figure className="min-w-0">
      <ChartContainer
        config={config}
        role="img"
        aria-label={label}
        className="aspect-auto h-56 w-full"
      >
        <BarChart
          data={[...points]}
          margin={{ top: 8, right: 4, left: 0 }}
          barGap={2}
        >
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tickFormatter={monthLabel}
            minTickGap={12}
          />
          <YAxis
            width={44}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value: number) =>
              format.number(value / 100, {
                notation: "compact",
                maximumFractionDigits: 1,
              })
            }
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(value) => monthLabel(String(value))}
                formatter={(value, name) => (
                  <span className="flex w-full justify-between gap-3">
                    <span className="text-muted-foreground">
                      {config[name as keyof typeof config]?.label}
                    </span>
                    <span className="font-medium tabular-nums">
                      {money(Number(value))}
                    </span>
                  </span>
                )}
              />
            }
          />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar
            isAnimationActive={false}
            dataKey="incomeCents"
            fill="var(--color-incomeCents)"
            radius={[4, 4, 0, 0]}
            maxBarSize={18}
          />
          <Bar
            isAnimationActive={false}
            dataKey="spentCents"
            fill="var(--color-spentCents)"
            radius={[4, 4, 0, 0]}
            maxBarSize={18}
          />
        </BarChart>
      </ChartContainer>
    </figure>
  );
}

/** La valeur nette, mois par mois : l'axe ne part pas de zéro pour montrer le progrès. */
export function NetWorthChart({
  points,
  currency,
  label,
}: {
  points: readonly { month: string; cents: number }[];
  currency: string;
  label: string;
}) {
  const t = useTranslations("Budget.accounts");
  const format = useFormatter();
  const monthLabel = useMonthLabel();
  const config = {
    cents: { label: t("netWorth"), color: "var(--chart-1)" },
  } satisfies ChartConfig;
  const money = (cents: number) => formatMoney(format, cents, currency);

  return (
    <figure className="min-w-0">
      <ChartContainer
        config={config}
        role="img"
        aria-label={label}
        className="aspect-auto h-44 w-full"
      >
        <LineChart data={[...points]} margin={{ top: 8, right: 12, left: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tickFormatter={monthLabel}
            minTickGap={16}
          />
          <YAxis
            width={44}
            tickLine={false}
            axisLine={false}
            domain={["auto", "auto"]}
            tickFormatter={(value: number) =>
              format.number(value / 100, {
                notation: "compact",
                maximumFractionDigits: 1,
              })
            }
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(value) => monthLabel(String(value))}
                formatter={(value) => (
                  <span className="font-medium tabular-nums">
                    {money(Number(value))}
                  </span>
                )}
              />
            }
          />
          <Line
            isAnimationActive={false}
            dataKey="cents"
            type="linear"
            stroke="var(--color-cents)"
            strokeWidth={2}
            dot={{ r: 4, fill: "var(--color-cents)", strokeWidth: 0 }}
            activeDot={{ r: 6, strokeWidth: 0 }}
          />
        </LineChart>
      </ChartContainer>
    </figure>
  );
}
