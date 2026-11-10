import { Check, CircleCheck, Landmark, TriangleAlert } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { toDbDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { MoneyView } from "@/server/budget/money";
import { displayMoney, formatMoney } from "../format";
import { MONEY_STEPS, type MoneyStep } from "../money-plan";

/** Le 1er jour du mois `month` du plan (1 : ce mois-ci). */
function planMonth(today: string, month: number) {
  return new Date(
    Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 2 + month),
  );
}

/**
 * « Ton plan d'argent » (décisions du fondateur, 2026-11-10) : l'argent est-il là à
 * la date de chaque paiement, où va le surplus ce mois-ci, puis les quatre étapes :
 * coussin, dettes (la plus chère d'abord), fonds d'urgence de 6 mois, placements.
 * Calculé par Get iT, sans IA.
 */
export async function MoneyPlanSection({
  money,
  today,
  currency,
}: {
  money: MoneyView;
  today: string;
  currency: string;
}) {
  const [t, format] = await Promise.all([
    getTranslations("Budget.money"),
    getFormatter(),
  ]);
  const cash = (cents: number) => formatMoney(format, cents, currency);
  const monthLabel = (month: number) =>
    format.dateTime(planMonth(today, month), {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  const { basis, plan } = money;
  const debtName = (id: string | null) =>
    money.debts.find((debt) => debt.id === id)?.name ?? "";
  const firstDebt = [...money.debts].sort(
    (a, b) => b.rateBp - a.rateBp || a.balanceCents - b.balanceCents,
  )[0];
  const totalDebt = money.debts.reduce(
    (sum, debt) => sum + debt.balanceCents,
    0,
  );

  // Où en est chaque étape : faite, pour quand, ou jamais avec ce surplus
  const monthOf = (step: MoneyStep) =>
    plan
      ? {
          cushion: plan.cushionMonth,
          debts: plan.debtsMonth,
          fund: plan.fundMonth,
          invest: plan.investMonth,
        }[step]
      : null;
  const statusOf = (step: MoneyStep) => {
    const month = monthOf(step);
    if (month === 0) return t("status.done");
    if (month === null) return t("status.never");
    return step === "invest"
      ? t("status.from", { date: monthLabel(month) })
      : t("status.by", { date: monthLabel(month) });
  };
  const savedLine = (target: number) =>
    t("saved", {
      saved: cash(Math.min(money.savedCents, target)),
      target: cash(target),
    });
  const textOf = (step: MoneyStep) => {
    switch (step) {
      case "cushion":
        return t("steps.cushion.text", { amount: cash(money.cushionCents) });
      case "debts":
        return firstDebt
          ? t("steps.debts.text", {
              count: money.debts.length,
              amount: cash(totalDebt),
              name: firstDebt.name,
              rate: firstDebt.rateBp / 100,
            })
          : t("steps.debts.none");
      case "fund":
        return t("steps.fund.text", { amount: cash(money.fundCents) });
      case "invest":
        return t("steps.invest.text", { amount: cash(plan?.investCents ?? 0) });
    }
  };

  return (
    <section
      aria-labelledby="money-plan"
      className="flex flex-col gap-4 border-t border-foreground/8 pt-6"
    >
      <div className="flex flex-col gap-1">
        <h2 id="money-plan" className="caps-label text-muted-foreground">
          {t("title")}
        </h2>
        <p className="text-xs text-pretty text-muted-foreground">{t("by")}</p>
      </div>

      {/* L'argent est-il là à la date de chaque paiement? */}
      {money.cash === null ? (
        <p className="flex items-start gap-2 text-sm text-pretty text-muted-foreground">
          <Landmark aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {t("cashNoAccount")}
        </p>
      ) : money.cash.shortfall ? (
        <p
          role="alert"
          className="flex items-start gap-2 text-sm font-medium text-pretty"
        >
          <TriangleAlert
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 text-primary"
          />
          {t("cashShort", {
            date: format.dateTime(toDbDate(money.cash.shortfall.day), {
              day: "numeric",
              month: "long",
              timeZone: "UTC",
            }),
            amount: cash(money.cash.shortfall.cents),
            label: money.cash.shortfall.label,
          })}
        </p>
      ) : (
        <p className="flex items-start gap-2 text-sm text-pretty">
          <CircleCheck
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 text-primary"
          />
          {t("cashOk", { amount: cash(money.cash.lowestCents) })}
        </p>
      )}

      {money.missing ? (
        <p className="text-sm text-pretty">
          {t(money.missing === "income" ? "noIncome" : "noSpending")}
        </p>
      ) : !plan ? (
        <p role="alert" className="text-sm font-medium text-pretty">
          {t("short", { amount: cash(-basis.surplusCents) })}
        </p>
      ) : (
        <>
          {/* Ce mois-ci : où va le surplus */}
          <div className="flex flex-col gap-2">
            <span className="caps-label text-muted-foreground">
              {t("thisMonth")}
            </span>
            <ul className="flex flex-col gap-2">
              {plan.thisMonth.map((line, index) => (
                <li
                  key={`${line.step}-${line.debtId ?? ""}`}
                  className="flex flex-wrap items-baseline gap-x-2"
                >
                  <span
                    className={cn(
                      "font-display leading-none tracking-wide tabular-nums",
                      index === 0 ? "text-4xl text-primary" : "text-2xl",
                    )}
                  >
                    {displayMoney(cash(line.cents))}
                  </span>
                  <span className="text-sm">
                    {line.step === "debts"
                      ? t("move.debts", { name: debtName(line.debtId) })
                      : t(`move.${line.step}`)}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Les quatre étapes, dans l'ordre */}
          <ol className="flex flex-col">
            {MONEY_STEPS.map((step, index) => {
              const done = monthOf(step) === 0;
              const now = plan.step === step;
              return (
                <li
                  key={step}
                  aria-current={now ? "step" : undefined}
                  className="flex gap-3 border-b border-foreground/8 py-3 last:border-b-0"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex w-7 shrink-0 justify-center font-display text-2xl leading-none tabular-nums",
                      now ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    {done ? (
                      <Check className="size-5" strokeWidth={2.5} />
                    ) : (
                      index + 1
                    )}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <span className="text-sm font-semibold">
                        {t(`steps.${step}.title`)}
                      </span>
                      <span
                        className={cn(
                          "text-xs first-letter:uppercase",
                          now
                            ? "font-semibold text-primary"
                            : "text-muted-foreground",
                        )}
                      >
                        {statusOf(step)}
                      </span>
                    </span>
                    <span className="text-xs text-pretty text-muted-foreground">
                      {textOf(step)}
                    </span>
                    {now && (step === "cushion" || step === "fund") ? (
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {savedLine(
                          step === "cushion"
                            ? money.cushionCents
                            : money.fundCents,
                        )}
                      </span>
                    ) : null}
                    {now ? (
                      <span className="pt-1 caps-label text-primary">
                        {t("status.now")}
                      </span>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ol>

          <p className="text-xs text-pretty text-muted-foreground tabular-nums">
            {t("basis", {
              income: cash(basis.incomeCents),
              spending: cash(basis.spendingCents),
              minimums: cash(basis.minimumsCents),
              surplus: cash(basis.surplusCents),
            })}
          </p>
        </>
      )}

      {money.incomplete.length > 0 ? (
        <p className="text-xs text-pretty text-muted-foreground">
          {t("incomplete", {
            names: money.incomplete.map((debt) => debt.name).join(", "),
          })}
        </p>
      ) : null}
      <Link
        href="/services/financial/budget/goals"
        className="flex min-h-11 w-fit items-center text-sm font-semibold text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {t("seeGoals")}
      </Link>
      <p className="text-xs text-pretty text-muted-foreground">
        {t("estimate")}
      </p>
    </section>
  );
}
