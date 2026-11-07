import { Search, X } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { getTransactions } from "@/server/budget/transactions";
import { getCurrentProfile } from "@/server/profile/service";
import {
  parseTransactionFilters,
  TRANSACTIONS_STEP,
  type TransactionFilters,
} from "../filters";
import { formatMoney } from "../format";
import { categoryName } from "../labels";
import { BudgetProvider } from "./budget-context";
import { BudgetActions, EntryList } from "./budget-lists";
import { ExportButton, ImportButton } from "./import-export";
import { TransactionFilterBar } from "./transaction-filters";

const TRANSACTIONS_PATH = "/services/financial/budget/transactions";

/** L'adresse avec les filtres en cours, en en changeant certains. */
function hrefWith(
  filters: TransactionFilters,
  change: Partial<
    Record<"cat" | "type" | "account" | "month" | "limit" | "q", string | null>
  >,
) {
  const query = {
    q: filters.q,
    cat: filters.category,
    type: filters.type,
    account: filters.account,
    month: filters.month,
    ...change,
  };
  return {
    pathname: TRANSACTIONS_PATH,
    query: Object.fromEntries(
      Object.entries(query).filter((entry): entry is [string, string] =>
        Boolean(entry[1]),
      ),
    ),
  };
}

/** Budget › Transactions : tout ce qui entre et sort, à chercher et à filtrer. */
export async function TransactionsLoader({
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
  const filters = parseTransactionFilters(params);
  const page = await getTransactions(profile.id, filters);
  const money = (cents: number) => formatMoney(format, cents, page.currency);
  const filtered = Boolean(
    filters.q ||
    filters.category ||
    filters.type ||
    filters.account ||
    filters.month,
  );
  const chips = [
    filters.category
      ? {
          key: "cat",
          label: categoryName(t, page.categories, filters.category),
        }
      : null,
    filters.type ? { key: "type", label: t(`kinds.${filters.type}`) } : null,
    filters.account
      ? {
          key: "account",
          label:
            page.accounts.find((account) => account.id === filters.account)
              ?.name ?? "",
        }
      : null,
    filters.month
      ? {
          key: "month",
          label: format.dateTime(new Date(`${filters.month}-01T00:00:00Z`), {
            month: "long",
            year: "numeric",
            timeZone: "UTC",
          }),
        }
      : null,
    filters.q ? { key: "q", label: `« ${filters.q} »` } : null,
  ].filter((chip) => chip !== null);

  return (
    <BudgetProvider
      value={{
        categories: page.categories,
        accounts: page.accounts,
        goals: page.goals,
        today: page.today,
        currency: page.currency,
      }}
    >
      <div className="flex flex-col gap-5">
        <BudgetActions />
        <TransactionFilterBar
          query={filters.q ?? ""}
          category={filters.category}
          type={filters.type}
          account={filters.account}
          month={filters.month}
        />
        {chips.length > 0 ? (
          <ul
            aria-label={t("transactions.active")}
            className="flex flex-wrap gap-2"
          >
            {chips.map((chip) => (
              <li key={chip.key}>
                <Link
                  href={hrefWith(filters, { [chip.key]: null })}
                  scroll={false}
                  transitionTypes={["nav-tab"]}
                  aria-label={t("transactions.remove", { filter: chip.label })}
                  className="flex min-h-10 items-center gap-1.5 rounded-full border border-primary bg-primary/15 px-3 text-sm font-medium outline-none first-letter:uppercase focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {chip.label}
                  <X aria-hidden="true" className="size-3.5" />
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
        <dl className="grid grid-cols-3 gap-3 border-y border-foreground/8 py-3">
          {(
            [
              ["count", t("transactions.count", { count: page.total })],
              ["in", money(page.incomeCents)],
              ["out", money(page.spentCents)],
            ] as const
          ).map(([key, value]) => (
            <div key={key} className="flex min-w-0 flex-col gap-0.5">
              <dt className="text-xs text-muted-foreground">
                {t(`transactions.totals.${key}`)}
              </dt>
              <dd className="truncate text-sm font-semibold tabular-nums">
                {value}
              </dd>
            </div>
          ))}
        </dl>
        {page.entries.length > 0 ? (
          <EntryList entries={page.entries} />
        ) : (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <Search
              aria-hidden="true"
              className="size-6 text-muted-foreground"
            />
            <p className="max-w-xs text-sm text-pretty text-muted-foreground">
              {filtered ? t("transactions.noMatch") : t("noEntries")}
            </p>
          </div>
        )}
        {page.total > page.entries.length ? (
          <Button asChild variant="outline" className="h-11 w-full">
            <Link
              href={hrefWith(filters, {
                limit: String(filters.limit + TRANSACTIONS_STEP),
              })}
              scroll={false}
              transitionTypes={["nav-tab"]}
            >
              {t("transactions.more")}
            </Link>
          </Button>
        ) : null}
        <div className="flex flex-col gap-3 border-t border-foreground/8 pt-6">
          <h2 className="caps-label text-muted-foreground">
            {t("transactions.fileTitle")}
          </h2>
          <p className="text-xs text-pretty text-muted-foreground">
            {t("transactions.fileText")}
          </p>
          <div className="flex flex-wrap gap-2">
            <ImportButton />
            <ExportButton />
          </div>
        </div>
      </div>
    </BudgetProvider>
  );
}

export function TransactionsSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <Skeleton className="h-12 w-full rounded-xl" />
      <Skeleton className="h-11 w-full rounded-xl" />
      {[0, 1, 2, 3, 4].map((index) => (
        <div key={index} className="flex items-center gap-3 py-2">
          <Skeleton className="size-10 rounded-full" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}
