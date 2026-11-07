import { ChevronLeft, ChevronRight, Receipt } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { toDbDate } from "@/lib/dates";
import { getBills } from "@/server/budget/transactions";
import { getCurrentProfile } from "@/server/profile/service";
import { displayMoney, formatMoney } from "../format";
import {
  monthlyEquivalent,
  monthStart,
  nextOccurrence,
  parseDay,
} from "../rules";
import { BillsCalendar } from "./bills-calendar";
import { BudgetProvider } from "./budget-context";
import { RecurringAddButton, RecurringList } from "./budget-lists";

const BILLS_PATH = "/services/financial/budget/bills";

/**
 * Budget › Factures : le calendrier du mois, ce qui s'en vient, le coût réel des
 * abonnements et tous les montants fixes.
 */
export async function BillsLoader({
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
  const page = await getBills(profile.id, parseDay(params.date));
  const { currency, today, month, rules } = page;
  const money = (cents: number) => formatMoney(format, cents, currency);
  const items = rules.map((rule) => ({
    ...rule,
    next: nextOccurrence(rule, today),
    monthlyCents: monthlyEquivalent(rule),
  }));
  const outflows = page.bills.filter((bill) => bill.kind === "expense");
  const paidCents = outflows
    .filter((bill) => bill.paid)
    .reduce((sum, bill) => sum + bill.amountCents, 0);
  const leftCents = outflows
    .filter((bill) => !bill.paid)
    .reduce((sum, bill) => sum + bill.amountCents, 0);
  const subscriptions = items.filter(
    (item) => item.category === "subscriptions" && item.next !== null,
  );
  const subscriptionsCents = subscriptions.reduce(
    (sum, item) => sum + item.monthlyCents,
    0,
  );
  const context = {
    categories: page.categories,
    accounts: page.accounts,
    goals: page.goals,
    today,
    currency,
  };

  return (
    <BudgetProvider value={context}>
      <div className="flex flex-col gap-6">
        {rules.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title={t("bills.emptyTitle")}
            description={t("bills.emptyText")}
          />
        ) : (
          <>
            <section
              aria-labelledby="bills-left"
              className="flex flex-col gap-1"
            >
              <h2 id="bills-left" className="caps-label text-muted-foreground">
                {t("bills.left")}
              </h2>
              <p className="font-display text-5xl leading-none tracking-wide tabular-nums">
                {displayMoney(money(leftCents))}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("bills.paid", { amount: money(paidCents) })}
              </p>
            </section>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold first-letter:uppercase">
                {format.dateTime(toDbDate(month), {
                  month: "long",
                  year: "numeric",
                  timeZone: "UTC",
                })}
              </h2>
              <div className="-mr-2 flex items-center">
                {(
                  [
                    [-1, t("previous.month"), ChevronLeft],
                    [1, t("following.month"), ChevronRight],
                  ] as const
                ).map(([step, label, Arrow]) => (
                  <Link
                    key={step}
                    href={{
                      pathname: BILLS_PATH,
                      query: { date: monthStart(month, step) },
                    }}
                    scroll={false}
                    transitionTypes={["nav-tab"]}
                    aria-label={label}
                    className="flex size-11 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-foreground/5 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <Arrow aria-hidden="true" className="size-5" />
                  </Link>
                ))}
              </div>
            </div>
            <BillsCalendar key={month} month={month} bills={page.bills} />
          </>
        )}

        {subscriptions.length > 0 ? (
          <section
            aria-labelledby="bills-subscriptions"
            className="flex flex-col gap-1 rounded-2xl bg-primary/[0.07] p-4"
          >
            <h2 id="bills-subscriptions" className="text-sm font-semibold">
              {t("bills.subscriptions", {
                count: subscriptions.length,
                amount: money(subscriptionsCents),
              })}
            </h2>
            <p className="text-xs text-pretty text-muted-foreground">
              {t("bills.subscriptionsYear", {
                amount: money(subscriptionsCents * 12),
              })}
            </p>
          </section>
        ) : null}

        <section
          aria-labelledby="bills-fixed"
          className="flex flex-col gap-3 border-t border-foreground/8 pt-6"
        >
          <h2 id="bills-fixed" className="caps-label text-muted-foreground">
            {t("fixed")}
          </h2>
          <div className="flex flex-wrap gap-2">
            <RecurringAddButton
              kind="expense"
              label={t("addFixedShort.expense")}
            />
            <RecurringAddButton
              kind="income"
              label={t("addFixedShort.income")}
            />
            {page.accounts.length >= 2 ? (
              <RecurringAddButton
                kind="transfer"
                label={t("addFixedShort.transfer")}
              />
            ) : null}
          </div>
          <RecurringList items={items} />
        </section>
      </div>
    </BudgetProvider>
  );
}

export function BillsSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-14 w-48" />
      <Skeleton className="h-72 w-full rounded-2xl" />
    </div>
  );
}
