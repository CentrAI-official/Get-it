import { ChevronLeft, ChevronRight, Lock, Wallet } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Link, type PageTransition } from "@/i18n/navigation";
import { toDbDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { getMoneyView } from "@/server/budget/money";
import { getBudget } from "@/server/budget/service";
import { getCurrentProfile } from "@/server/profile/service";
import { displayMoney, formatMoney } from "../format";
import {
  BUDGET_VIEWS,
  monthStart,
  parseDay,
  periodOf,
  parseView,
  shiftPeriod,
  type BudgetView,
} from "../rules";
import { BudgetProvider } from "./budget-context";
import { AssignBanner } from "./assign-sheet";
import { EntryList, EraseBudgetButton } from "./budget-lists";
import { BudgetSetupButton } from "./budget-setup";
import { AnnualToPrepare } from "./envelope-dialogs";
import { EnvelopeTiles, QuickSpend } from "./envelope-tiles";
import { FixedPaymentsTile } from "./fixed-payments";
import { ProgressTiles } from "./progress-tiles";

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
 * Financier › Budget › Enveloppes (décision du fondateur, 2026-11-12, maquette 3) :
 * les dollars sans enveloppe et « Répartir », une carte par enveloppe avec ce qui
 * y reste, les paiements fixes à cocher, les dettes et l'épargne, la dépense
 * rapide et les dernières transactions. Les enveloppes se comptent au mois ; les
 * vues Jour et Semaine ajoutent ce qui est sorti pendant la période.
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
  const { plan } = budget;
  const month = monthStart(start);
  const currentMonth = today >= month && today <= periodOf("month", month).end;
  // « Répartir » reprend la suggestion du plan d'argent (mois en cours seulement)
  const moneyView =
    view === "month" && current ? await getMoneyView(profile.id, budget) : null;
  // La destination seulement : le montant est celui qui reste sans enveloppe
  const first = moneyView?.plan?.thisMonth[0];
  const target = first
    ? first.step === "debts"
      ? t("money.move.debts", {
          name:
            moneyView.debts.find((debt) => debt.id === first.debtId)?.name ??
            "",
        })
      : t(`money.move.${first.step}`)
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

        {view === "month" ? (
          <AssignBanner
            plan={plan}
            month={month}
            elapsed={budget.elapsed}
            target={target}
            goalsMonthlyCents={budget.goalsMonthlyCents}
          />
        ) : (
          // Jour et Semaine : ce qui est sorti pendant la période
          <section
            aria-labelledby="budget-spent"
            className="flex flex-col gap-1"
          >
            <h2 id="budget-spent" className="caps-label text-muted-foreground">
              {t(`envelopes.spent.${view}${current ? "" : "Other"}`)}
            </h2>
            <p className="font-display text-6xl leading-none tracking-wide tabular-nums">
              {displayMoney(money(summary.spentCents))}
            </p>
            {summary.upcomingCents > 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("envelopes.upcoming", {
                  amount: money(summary.upcomingCents),
                })}
              </p>
            ) : null}
          </section>
        )}

        {/* Les enveloppes du mois, puis les paiements fixes, les dettes et l'épargne */}
        <section
          aria-labelledby="budget-envelopes"
          className="flex flex-col gap-3"
        >
          <h2 id="budget-envelopes" className="sr-only">
            {t("envelopes.title")}
          </h2>
          <div className="grid grid-cols-2 gap-2.5">
            <EnvelopeTiles
              plan={plan}
              month={month}
              elapsed={budget.elapsed}
              period={
                view === "month"
                  ? null
                  : {
                      view,
                      current,
                      cents: Object.fromEntries(
                        summary.categories.map((line) => [
                          line.category,
                          line.cents,
                        ]),
                      ),
                    }
              }
              showEmpty={view === "month"}
            />
            <FixedPaymentsTile
              fixed={budget.fixed}
              leftover={budget.leftover}
              pays={currentMonth ? budget.pays : []}
            />
            {view === "month" ? (
              <ProgressTiles
                debts={budget.progress.debts}
                goals={budget.progress.goals}
                currency={currency}
              />
            ) : null}
          </div>
        </section>

        {view === "month" ? (
          <AnnualToPrepare items={budget.annual} month={month} />
        ) : null}

        <QuickSpend plan={plan} elapsed={budget.elapsed} />

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
