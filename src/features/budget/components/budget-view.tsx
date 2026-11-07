import { ChevronLeft, ChevronRight, Lock, Wallet } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Link, type PageTransition } from "@/i18n/navigation";
import { toDbDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { getBudget } from "@/server/budget/service";
import { getCurrentProfile } from "@/server/profile/service";
import { displayMoney, formatMoney } from "../format";
import { categoryName } from "../labels";
import {
  BUDGET_VIEWS,
  monthStart,
  parseDay,
  parseView,
  shiftPeriod,
  type BudgetView,
} from "../rules";
import { BudgetProvider } from "./budget-context";
import { BudgetActions, EntryList, EraseBudgetButton } from "./budget-lists";
import { BudgetSetupButton } from "./budget-setup";
import { CategoryIcon } from "./category-icon";
import { BarSwatch, MonthBar } from "./month-bar";
import { PlanSection } from "./plan-section";

const BUDGET_PATH = "/services/financial/budget";

const periodHref = (view: BudgetView, date: string) => ({
  pathname: BUDGET_PATH,
  query: { view, date },
});

/** Lien d'une période : on reste sur la page (fondu, sans remonter en haut). */
const periodLink: { scroll: false; transitionTypes: PageTransition[] } = {
  scroll: false,
  transitionTypes: ["nav-tab"],
};

/** Transactions montrées dans la vue Mois : la suite est dans l'onglet Transactions. */
const RECENT_ENTRIES = 5;

/**
 * Financier › Budget : la période choisie (jour, semaine ou mois), ce qui reste à
 * dépenser, la barre du mois, le plan par catégorie, ce qui s'en vient et les
 * dernières transactions.
 */
export async function BudgetLoader({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [profile, params, t, format] = await Promise.all([
    getCurrentProfile(),
    searchParams,
    getTranslations("Budget"),
    getFormatter(),
  ]);
  const view = parseView(params.view);
  const budget = await getBudget(profile.id, {
    view,
    day: parseDay(params.date),
  });
  const { summary, currency, today, start, end, categories } = budget;
  const money = (cents: number) => formatMoney(format, cents, currency);
  const context = {
    categories,
    accounts: budget.accounts,
    goals: budget.goals,
    today,
    currency,
  };

  const privacy = (
    <p className="flex items-start gap-2 text-xs text-muted-foreground">
      <Lock aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
      {t("privacy")}
    </p>
  );

  if (budget.empty) {
    return (
      <BudgetProvider value={context}>
        <div className="flex flex-col gap-6">
          <EmptyState
            icon={Wallet}
            title={t("empty.title")}
            description={t("empty.description")}
            action={<BudgetSetupButton />}
          />
          {privacy}
        </div>
      </BudgetProvider>
    );
  }

  const current = today >= start && today <= end;
  const income = summary.incomeCents + summary.upcomingIncomeCents;
  // L'épargne faite, à venir et prévue : la barre s'additionne jusqu'aux revenus
  const saved =
    summary.savedCents + summary.upcomingSavedCents + summary.reserveCents;
  const label =
    view === "day"
      ? format.dateTime(toDbDate(start), {
          weekday: "long",
          day: "numeric",
          month: "long",
          timeZone: "UTC",
        })
      : view === "week"
        ? format.dateTimeRange(toDbDate(start), toDbDate(end), {
            day: "numeric",
            month: "long",
            timeZone: "UTC",
          })
        : format.dateTime(toDbDate(start), {
            month: "long",
            year: "numeric",
            timeZone: "UTC",
          });
  const outTotal = Math.max(
    summary.categories.reduce((sum, line) => sum + line.cents, 0),
    1,
  );
  const shownEntries =
    view === "month" ? budget.entries.slice(0, RECENT_ENTRIES) : budget.entries;

  return (
    <BudgetProvider value={context}>
      <div className="flex flex-col gap-6">
        {/* Période : jour, semaine ou mois, et ses flèches */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold first-letter:uppercase">
              {label}
            </h2>
            <div className="-mr-2 flex items-center gap-1">
              {current ? null : (
                <Link
                  href={periodHref(view, today)}
                  {...periodLink}
                  className="flex h-10 items-center rounded-full px-3 text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {t("today")}
                </Link>
              )}
              {(
                [
                  [-1, t(`previous.${view}`), ChevronLeft],
                  [1, t(`following.${view}`), ChevronRight],
                ] as const
              ).map(([step, stepLabel, Arrow]) => (
                <Link
                  key={step}
                  href={periodHref(view, shiftPeriod(view, start, step))}
                  {...periodLink}
                  aria-label={stepLabel}
                  className="flex size-11 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-foreground/5 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <Arrow aria-hidden="true" className="size-5" />
                </Link>
              ))}
            </div>
          </div>
          <nav
            aria-label={t("viewLabel")}
            className="flex w-fit gap-0.5 rounded-full bg-foreground/5 p-1"
          >
            {BUDGET_VIEWS.map((value) => (
              <Link
                key={value}
                href={periodHref(value, current ? today : start)}
                {...periodLink}
                aria-current={value === view ? "page" : undefined}
                className={cn(
                  "flex h-9 items-center rounded-full px-3.5 text-sm font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  value === view
                    ? "bg-foreground/12 text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t(`views.${value}`)}
              </Link>
            ))}
          </nav>
        </div>

        {/* Ce qui reste à dépenser, et la barre : où va chaque dollar */}
        <section
          aria-labelledby="budget-remaining"
          className="flex flex-col gap-3"
        >
          <div className="flex flex-col gap-1">
            <h2
              id="budget-remaining"
              className="caps-label text-muted-foreground"
            >
              {income <= 0
                ? t("spentHero")
                : current
                  ? t(`remaining.${view}`)
                  : t("remaining.other")}
            </h2>
            <p className="font-display text-6xl leading-none tracking-wide tabular-nums">
              {displayMoney(
                money(
                  income <= 0
                    ? summary.spentCents + summary.upcomingCents
                    : summary.remainingCents,
                ),
              )}
            </p>
            {income <= 0 ? (
              <p className="text-sm text-muted-foreground">{t("noIncome")}</p>
            ) : summary.remainingCents < 0 ? (
              <p className="text-sm font-medium">
                {t("over", { amount: money(-summary.remainingCents) })}
              </p>
            ) : view !== "day" && summary.perDayCents !== null ? (
              <p className="text-sm">
                {t("perDay", {
                  amount: money(summary.perDayCents),
                  days: summary.daysLeft,
                })}
              </p>
            ) : null}
          </div>
          <MonthBar
            spentCents={summary.spentCents}
            upcomingCents={summary.upcomingCents}
            savedCents={saved}
            incomeCents={income}
            label={t("barLabel", {
              income: money(income),
              spent: money(summary.spentCents),
              upcoming: money(summary.upcomingCents),
              saved: money(saved),
            })}
          />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {(
              [
                ["spent", summary.spentCents, "spent"],
                ["upcoming", summary.upcomingCents, "upcoming"],
                ["saved", saved, "saved"],
                ["left", Math.max(summary.remainingCents, 0), "left"],
              ] as const
            ).map(([key, cents, swatch]) => (
              <div key={key} className="flex min-w-0 items-center gap-2">
                <BarSwatch kind={swatch} />
                <dt className="truncate text-muted-foreground">
                  {t(`totals.${key}`)}
                </dt>
                <dd className="ml-auto font-semibold tabular-nums">
                  {money(cents)}
                </dd>
              </div>
            ))}
          </dl>
          {income > 0 ? (
            <p className="text-xs text-muted-foreground">
              {t("incomeLine", { amount: money(income) })}
            </p>
          ) : null}
        </section>

        <BudgetActions />

        {budget.plan ? (
          <PlanSection
            plan={budget.plan}
            month={monthStart(start)}
            elapsed={budget.elapsed}
            suggestion={budget.suggestion}
            annual={budget.annual}
            goalsMonthlyCents={budget.goalsMonthlyCents}
          />
        ) : summary.categories.length > 0 ? (
          <section
            aria-labelledby="budget-categories"
            className="flex flex-col gap-3 border-t border-foreground/8 pt-6"
          >
            <h2
              id="budget-categories"
              className="caps-label text-muted-foreground"
            >
              {t("byCategory")}
            </h2>
            <ul className="flex flex-col gap-3">
              {summary.categories.map(({ category, cents }) => {
                const share = Math.round((cents / outTotal) * 100);
                return (
                  <li key={category} className="flex items-center gap-3">
                    <CategoryIcon
                      category={category}
                      categories={categories}
                      className="size-[18px] shrink-0 text-muted-foreground"
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="truncate font-medium">
                          {categoryName(t, categories, category)}
                        </span>
                        <span className="shrink-0 tabular-nums">
                          {money(cents)}
                          <span className="ml-1.5 text-xs text-muted-foreground">
                            {t("share", { percent: share })}
                          </span>
                        </span>
                      </div>
                      <div
                        aria-hidden="true"
                        className="h-1.5 overflow-hidden rounded-full bg-foreground/8"
                      >
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${Math.max(share, 2)}%` }}
                        />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {budget.nextUp.length > 0 ? (
          <section
            aria-labelledby="budget-next"
            className="flex flex-col gap-1 border-t border-foreground/8 pt-6"
          >
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="budget-next" className="caps-label text-muted-foreground">
                {t("nextUp")}
              </h2>
              <Link
                href="/services/financial/budget/bills"
                className="flex min-h-10 items-center text-sm font-semibold text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {t("seeBills")}
              </Link>
            </div>
            <ul className="flex flex-col">
              {budget.nextUp.map((item) => (
                <li
                  key={`${item.recurringId}-${item.day}`}
                  className="flex items-center gap-3 border-b border-foreground/8 py-2.5 last:border-b-0"
                >
                  {/* Le jour en grand, son mois dessous, comme une page de calendrier */}
                  <span className="flex w-12 shrink-0 flex-col items-center">
                    <span className="font-display text-2xl leading-none tracking-wide text-primary tabular-nums">
                      {format.dateTime(toDbDate(item.day), {
                        day: "numeric",
                        timeZone: "UTC",
                      })}
                    </span>
                    <span className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                      {format.dateTime(toDbDate(item.day), {
                        month: "short",
                        timeZone: "UTC",
                      })}
                    </span>
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-semibold">
                      {item.label}
                    </span>
                    <span className="text-xs text-muted-foreground first-letter:uppercase">
                      {format.dateTime(toDbDate(item.day), {
                        weekday: "long",
                        timeZone: "UTC",
                      })}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">
                    {formatMoney(
                      format,
                      item.amountCents,
                      currency,
                      item.kind === "income"
                        ? "income"
                        : item.kind === "expense"
                          ? "expense"
                          : undefined,
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section
          aria-labelledby="budget-entries"
          className="flex flex-col gap-3 border-t border-foreground/8 pt-6"
        >
          <div className="flex items-baseline justify-between gap-3">
            <h2
              id="budget-entries"
              className="caps-label text-muted-foreground"
            >
              {t(view === "month" ? "recent" : "entries")}
            </h2>
            <Link
              href="/services/financial/budget/transactions"
              className="flex min-h-10 items-center text-sm font-semibold text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {t("seeAll")}
            </Link>
          </div>
          <EntryList entries={shownEntries} />
        </section>

        <div className="flex flex-col items-start gap-3 border-t border-foreground/8 pt-6">
          {privacy}
          <EraseBudgetButton />
        </div>
      </div>
    </BudgetProvider>
  );
}

export function BudgetSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-10 w-24 rounded-full" />
      </div>
      <Skeleton className="h-11 w-56 rounded-full" />
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-14 w-56" />
      <Skeleton className="h-6 w-full rounded-lg" />
      <div className="grid grid-cols-2 gap-3">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-5" />
        ))}
      </div>
    </div>
  );
}
