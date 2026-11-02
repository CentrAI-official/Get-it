import { ChevronLeft, ChevronRight, Lock, Wallet } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Link, type PageTransition } from "@/i18n/navigation";
import { toDbDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { getBudget } from "@/server/budget/service";
import { getCurrentProfile } from "@/server/profile/service";
import { formatMoney } from "../format";
import { CATEGORY_ICONS } from "../icons";
import {
  BUDGET_VIEWS,
  parseDay,
  parseView,
  shiftPeriod,
  type BudgetView,
} from "../rules";
import {
  BudgetAddButtons,
  EntryList,
  EraseBudgetButton,
  RecurringAddButton,
  RecurringList,
} from "./budget-lists";

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

/**
 * Financier › Budget : la période choisie (jour, semaine ou mois), ce qui
 * reste, les dépenses par catégorie, les mouvements et les montants fixes.
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
  const { summary, currency, today, start, end } = budget;
  const money = (cents: number, kind?: "income" | "expense") =>
    formatMoney(format, cents, currency, kind);

  const privacy = (
    <p className="flex items-start gap-2 text-xs text-muted-foreground">
      <Lock aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
      {t("privacy")}
    </p>
  );

  if (budget.empty) {
    return (
      <div className="flex flex-col gap-6">
        <EmptyState
          icon={Wallet}
          title={t("empty.title")}
          description={t("empty.description")}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <RecurringAddButton
                kind="income"
                label={t("addFixed.income")}
                today={today}
                variant="default"
              />
              <RecurringAddButton
                kind="expense"
                label={t("addFixed.expense")}
                today={today}
              />
            </div>
          }
        />
        {privacy}
      </div>
    );
  }

  const current = today >= start && today <= end;
  const outCents = summary.fixedCents + summary.spentCents;
  const used =
    summary.incomeCents > 0
      ? Math.round((outCents / summary.incomeCents) * 100)
      : null;
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
  const outTotal = Math.max(outCents, 1);

  return (
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
                className="flex h-9 items-center rounded-full px-3 text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
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
                className="flex size-10 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-foreground/5 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
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

      {/* Ce qui reste */}
      <section
        aria-labelledby="budget-remaining"
        className="flex flex-col gap-3"
      >
        <div className="flex flex-col gap-1">
          <h2
            id="budget-remaining"
            className="caps-label text-muted-foreground"
          >
            {current ? t(`remaining.${view}`) : t("remaining.other")}
          </h2>
          <p className="font-display text-5xl tracking-wide tabular-nums">
            {/* Anton n'a pas l'espace fine des milliers : espace insécable */}
            {money(summary.remainingCents).replace(/ /g, " ")}
          </p>
          {summary.remainingCents < 0 ? (
            <p className="text-sm font-medium">
              {t("over", { amount: money(-summary.remainingCents) })}
            </p>
          ) : null}
        </div>
        {used !== null ? (
          <div className="flex flex-col gap-1.5">
            <Progress value={Math.min(used, 100)} aria-label={t("usedLabel")} />
            <p className="text-xs text-muted-foreground">
              {t("used", { percent: used })}
            </p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{t("noIncome")}</p>
        )}
        <dl className="grid grid-cols-3 gap-3 border-t border-foreground/8 pt-3">
          {(
            [
              ["income", summary.incomeCents, "income"],
              ["fixed", summary.fixedCents, "expense"],
              ["spent", summary.spentCents, "expense"],
            ] as const
          ).map(([key, cents, kind]) => (
            <div key={key} className="flex min-w-0 flex-col gap-0.5">
              <dt className="text-xs text-muted-foreground">
                {t(`totals.${key}`)}
              </dt>
              <dd className="text-base font-semibold tabular-nums">
                {cents === 0 ? money(0) : money(cents, kind)}
              </dd>
              {key === "fixed" && summary.upcomingFixedCents > 0 ? (
                <dd className="text-xs text-muted-foreground">
                  {t("upcoming", { amount: money(summary.upcomingFixedCents) })}
                </dd>
              ) : null}
            </div>
          ))}
        </dl>
        {view !== "day" && summary.perDayCents !== null ? (
          <p className="text-sm">
            {t("perDay", {
              amount: money(summary.perDayCents),
              days: summary.daysLeft,
            })}
          </p>
        ) : null}
      </section>

      <BudgetAddButtons today={today} />

      {summary.categories.length > 0 ? (
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
              const Icon = CATEGORY_ICONS[category];
              const share = Math.round((cents / outTotal) * 100);
              return (
                <li key={category} className="flex items-center gap-3">
                  <Icon
                    aria-hidden="true"
                    className="size-[18px] shrink-0 text-muted-foreground"
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="truncate font-medium">
                        {t(`categories.${category}`)}
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

      <section
        aria-labelledby="budget-entries"
        className="flex flex-col gap-3 border-t border-foreground/8 pt-6"
      >
        <h2 id="budget-entries" className="caps-label text-muted-foreground">
          {t("entries")}
        </h2>
        <EntryList entries={budget.entries} currency={currency} today={today} />
      </section>

      <section
        aria-labelledby="budget-fixed"
        className="flex flex-col gap-3 border-t border-foreground/8 pt-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="budget-fixed" className="caps-label text-muted-foreground">
            {t("fixed")}
          </h2>
          <div className="flex flex-wrap gap-2">
            <RecurringAddButton
              kind="income"
              label={t("addFixedShort.income")}
              today={today}
            />
            <RecurringAddButton
              kind="expense"
              label={t("addFixedShort.expense")}
              today={today}
            />
          </div>
        </div>
        <RecurringList
          items={budget.recurring}
          currency={currency}
          today={today}
        />
      </section>

      <div className="flex flex-col items-start gap-3 border-t border-foreground/8 pt-6">
        {privacy}
        <EraseBudgetButton />
      </div>
    </div>
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
      <Skeleton className="h-12 w-48" />
      <Skeleton className="h-2 w-full rounded-full" />
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} className="h-10" />
        ))}
      </div>
    </div>
  );
}
