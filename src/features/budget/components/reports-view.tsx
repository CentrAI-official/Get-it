import { BarChart3, TrendingDown, TrendingUp } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { toDbDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { getReports } from "@/server/budget/transactions";
import { getCurrentProfile } from "@/server/profile/service";
import { BUDGET_GROUPS } from "../categories";
import { displayMoney, formatMoney } from "../format";
import { categoryName } from "../labels";
import {
  cashFlow,
  categoryTrends,
  groupShares,
  parseRange,
  REPORT_RANGES,
  savingsRate,
} from "../reports";
import { BudgetProvider } from "./budget-context";
import { CashFlowChart } from "./budget-charts";
import { CategoryIcon } from "./category-icon";

/** Budget › Rapports : d'où vient l'argent, où il va, et comment ça évolue. */
export async function ReportsLoader({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [profile, params, t, tBudget, format] = await Promise.all([
    getCurrentProfile(),
    searchParams,
    getTranslations("Budget.reports"),
    getTranslations("Budget"),
    getFormatter(),
  ]);
  const range = parseRange(params.range);
  const page = await getReports(profile.id, range);
  const money = (cents: number) => formatMoney(format, cents, page.currency);
  const points = cashFlow(page.rollups, page.months);
  const thisMonth = page.months.at(-1) ?? page.today.slice(0, 7);
  const trends = categoryTrends(page.rollups, thisMonth);
  const shares = groupShares(
    page.months.map((month) => ({ rollup: page.rollups.get(month) })),
    page.categories,
  );
  const rate = savingsRate(points);
  const income = points.reduce((sum, point) => sum + point.incomeCents, 0);
  const spent = points.reduce((sum, point) => sum + point.spentCents, 0);
  const empty = points.every(
    (point) => point.incomeCents === 0 && point.spentCents === 0,
  );
  const context = {
    categories: page.categories,
    accounts: page.accounts,
    goals: page.goals,
    today: page.today,
    currency: page.currency,
  };

  return (
    <BudgetProvider value={context}>
      <div className="flex flex-col gap-6">
        <nav
          aria-label={t("rangeLabel")}
          className="flex w-fit gap-0.5 rounded-full bg-foreground/5 p-1"
        >
          {REPORT_RANGES.map((value) => (
            <Link
              key={value}
              href={{
                pathname: "/services/financial/budget/reports",
                query: { range: String(value) },
              }}
              scroll={false}
              transitionTypes={["nav-tab"]}
              aria-current={value === range ? "page" : undefined}
              className={cn(
                "flex h-9 items-center rounded-full px-3.5 text-sm font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                value === range
                  ? "bg-foreground/12 text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t("range", { months: value })}
            </Link>
          ))}
        </nav>

        {empty ? (
          <EmptyState
            icon={BarChart3}
            title={t("emptyTitle")}
            description={t("emptyText")}
          />
        ) : (
          <>
            <section
              aria-labelledby="report-rate"
              className="grid grid-cols-2 gap-4"
            >
              <div className="flex flex-col gap-1">
                <h2
                  id="report-rate"
                  className="caps-label text-muted-foreground"
                >
                  {t("savingsRate")}
                </h2>
                <p className="font-display text-5xl leading-none tracking-wide tabular-nums">
                  {rate === null ? "—" : `${rate} %`}
                </p>
              </div>
              <dl className="flex flex-col justify-end gap-1 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">{t("income")}</dt>
                  <dd className="font-semibold tabular-nums">
                    {money(income)}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">{t("spent")}</dt>
                  <dd className="font-semibold tabular-nums">{money(spent)}</dd>
                </div>
              </dl>
            </section>

            <section
              aria-labelledby="report-flow"
              className="flex flex-col gap-3 border-t border-foreground/8 pt-6"
            >
              <h2 id="report-flow" className="caps-label text-muted-foreground">
                {t("flowTitle")}
              </h2>
              <CashFlowChart
                points={points}
                currency={page.currency}
                label={t("flowLabel", {
                  months: page.months.length,
                  income: money(income),
                  spent: money(spent),
                })}
              />
              <ul className="flex flex-col text-sm">
                {[...points].reverse().map((point) => (
                  <li
                    key={point.month}
                    className="flex items-baseline justify-between gap-3 border-b border-foreground/8 py-2 last:border-b-0"
                  >
                    <span className="first-letter:uppercase">
                      {format.dateTime(toDbDate(`${point.month}-01`), {
                        month: "long",
                        year: "numeric",
                        timeZone: "UTC",
                      })}
                    </span>
                    <span
                      className={cn(
                        "font-semibold tabular-nums",
                        point.netCents < 0 && "text-primary",
                      )}
                    >
                      {point.incomeCents === 0 &&
                      point.spentCents === 0 &&
                      point.savedCents === 0
                        ? "—"
                        : formatMoney(
                            format,
                            point.netCents,
                            page.currency,
                            point.netCents < 0 ? "expense" : "income",
                          )}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">{t("netHint")}</p>
            </section>

            <section
              aria-labelledby="report-split"
              className="flex flex-col gap-3 border-t border-foreground/8 pt-6"
            >
              <h2
                id="report-split"
                className="caps-label text-muted-foreground"
              >
                {t("splitTitle")}
              </h2>
              <ul className="flex flex-col gap-3">
                {BUDGET_GROUPS.map((group) => {
                  const share = shares[group];
                  return (
                    <li key={group} className="flex flex-col gap-1.5">
                      <span className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="font-semibold">
                          {tBudget(`groups.${group}`)}
                        </span>
                        <span className="tabular-nums">
                          {share.percent === null
                            ? money(share.cents)
                            : t("share", {
                                percent: share.percent,
                                target: share.target,
                              })}
                        </span>
                      </span>
                      <span
                        aria-hidden="true"
                        className="relative h-2 rounded-full bg-foreground/8"
                      >
                        <span
                          style={{
                            width: `${Math.min(share.percent ?? 0, 100)}%`,
                          }}
                          className="absolute inset-y-0 left-0 rounded-full bg-primary"
                        />
                        <span
                          style={{ left: `${share.target}%` }}
                          className="absolute -top-0.5 -bottom-0.5 w-0.5 -translate-x-1/2 rounded-full bg-foreground"
                        />
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="text-xs text-pretty text-muted-foreground">
                {t("splitHint")}
              </p>
            </section>

            {trends.length > 0 ? (
              <section
                aria-labelledby="report-trends"
                className="flex flex-col gap-1 border-t border-foreground/8 pt-6"
              >
                <h2
                  id="report-trends"
                  className="caps-label text-muted-foreground"
                >
                  {t("trendsTitle")}
                </h2>
                <ul className="flex flex-col">
                  {trends.map((trend) => {
                    const delta =
                      trend.averageCents && trend.averageCents > 0
                        ? Math.round(
                            ((trend.cents - trend.averageCents) /
                              trend.averageCents) *
                              100,
                          )
                        : null;
                    return (
                      <li
                        key={trend.key}
                        className="flex items-center gap-3 border-b border-foreground/8 py-2.5 last:border-b-0"
                      >
                        <CategoryIcon
                          category={trend.key}
                          categories={page.categories}
                          className="size-[18px] shrink-0 text-muted-foreground"
                        />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                          {categoryName(tBudget, page.categories, trend.key)}
                        </span>
                        <span className="flex shrink-0 flex-col items-end">
                          <span className="text-sm font-semibold tabular-nums">
                            {money(trend.cents)}
                          </span>
                          {delta !== null && delta !== 0 ? (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
                              {delta > 0 ? (
                                <TrendingUp
                                  aria-hidden="true"
                                  className="size-3.5 text-primary"
                                />
                              ) : (
                                <TrendingDown
                                  aria-hidden="true"
                                  className="size-3.5"
                                />
                              )}
                              {t(delta > 0 ? "above" : "below", {
                                delta: Math.abs(delta),
                              })}
                            </span>
                          ) : null}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null}

            {page.biggest.length > 0 ? (
              <section
                aria-labelledby="report-biggest"
                className="flex flex-col gap-1 border-t border-foreground/8 pt-6"
              >
                <h2
                  id="report-biggest"
                  className="caps-label text-muted-foreground"
                >
                  {t("biggestTitle")}
                </h2>
                <ol className="flex flex-col">
                  {page.biggest.map((entry, index) => (
                    <li
                      key={entry.id}
                      className="flex items-center gap-3 border-b border-foreground/8 py-2.5 last:border-b-0"
                    >
                      <span className="w-6 shrink-0 font-display text-xl leading-none text-primary tabular-nums">
                        {index + 1}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-medium">
                          {entry.note ??
                            categoryName(
                              tBudget,
                              page.categories,
                              entry.category,
                            )}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {format.dateTime(toDbDate(entry.occurredOn), {
                            day: "numeric",
                            month: "short",
                            timeZone: "UTC",
                          })}
                        </span>
                      </span>
                      <span className="shrink-0 text-sm font-semibold tabular-nums">
                        {displayMoney(money(entry.amountCents))}
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}
          </>
        )}
      </div>
    </BudgetProvider>
  );
}

export function ReportsSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-11 w-56 rounded-full" />
      <Skeleton className="h-14 w-40" />
      <Skeleton className="h-56 w-full rounded-2xl" />
    </div>
  );
}
