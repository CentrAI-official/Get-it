import { Landmark } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { getAccountsPage } from "@/server/budget/accounts";
import { getCurrentProfile } from "@/server/profile/service";
import { ACCOUNT_TYPES, isDebtType } from "../accounts";
import { displayMoney, formatMoney } from "../format";
import { AccountAddButton, AccountRow } from "./account-dialogs";
import { BudgetProvider } from "./budget-context";
import { NetWorthChart } from "./budget-charts";

/** Budget › Comptes : la valeur nette, ce qu'on a et ce qu'on doit. */
export async function AccountsLoader() {
  const [profile, t, format] = await Promise.all([
    getCurrentProfile(),
    getTranslations("Budget.accounts"),
    getFormatter(),
  ]);
  const page = await getAccountsPage(profile.id);
  const money = (cents: number) => formatMoney(format, cents, page.currency);
  const context = {
    categories: page.categories,
    accounts: page.accounts,
    goals: page.goals,
    today: page.today,
    currency: page.currency,
  };
  const first = page.series[0];
  const last = page.series.at(-1);
  const groups = ACCOUNT_TYPES.map((type) => ({
    type,
    lines: page.lines.filter((line) => line.type === type),
  })).filter((group) => group.lines.length > 0);

  return (
    <BudgetProvider value={context}>
      <div className="flex flex-col gap-6">
        {page.lines.length === 0 ? (
          <EmptyState
            icon={Landmark}
            title={t("emptyTitle")}
            description={t("emptyText")}
            action={<AccountAddButton variant="default" />}
          />
        ) : (
          <>
            <section
              aria-labelledby="net-worth"
              className="flex flex-col gap-3"
            >
              <div className="flex flex-col gap-1">
                <h2 id="net-worth" className="caps-label text-muted-foreground">
                  {t("netWorth")}
                </h2>
                <p className="font-display text-6xl leading-none tracking-wide tabular-nums">
                  {displayMoney(money(page.netCents))}
                </p>
              </div>
              <dl className="grid grid-cols-2 gap-3 border-y border-foreground/8 py-3">
                <div className="flex flex-col gap-0.5">
                  <dt className="text-xs text-muted-foreground">{t("have")}</dt>
                  <dd className="text-base font-semibold tabular-nums">
                    {money(page.assetsCents)}
                  </dd>
                </div>
                <div className="flex flex-col gap-0.5">
                  <dt className="text-xs text-muted-foreground">{t("owe")}</dt>
                  <dd className="text-base font-semibold tabular-nums">
                    {money(page.debtsCents)}
                  </dd>
                </div>
              </dl>
              {page.series.length >= 2 && first && last ? (
                <NetWorthChart
                  points={page.series}
                  currency={page.currency}
                  label={t("chartLabel", {
                    first: money(first.cents),
                    last: money(last.cents),
                  })}
                />
              ) : (
                <p className="text-xs text-pretty text-muted-foreground">
                  {t("chartSoon")}
                </p>
              )}
            </section>

            {groups.map((group) => (
              <section
                key={group.type}
                aria-label={t(`types.${group.type}`)}
                className="flex flex-col gap-1 border-t border-foreground/8 pt-6"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="caps-label text-muted-foreground">
                    {t(`types.${group.type}`)}
                  </h2>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {money(
                      group.lines.reduce(
                        (sum, line) => sum + line.balanceCents,
                        0,
                      ),
                    )}
                  </span>
                </div>
                <ul className="flex flex-col">
                  {group.lines.map((line) => (
                    <AccountRow
                      key={line.id}
                      line={line}
                      debt={isDebtType(line.type)}
                      paid={page.rules.some(
                        (rule) => rule.toAccountId === line.id,
                      )}
                    />
                  ))}
                </ul>
              </section>
            ))}
            <AccountAddButton />
          </>
        )}
        <p className="text-xs text-pretty text-muted-foreground">
          {t("manualNote")}
        </p>
      </div>
    </BudgetProvider>
  );
}

export function AccountsSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-14 w-56" />
      <Skeleton className="h-44 w-full rounded-2xl" />
    </div>
  );
}
