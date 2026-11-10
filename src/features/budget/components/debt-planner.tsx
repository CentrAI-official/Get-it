"use client";

import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useId, useState } from "react";
import { cn } from "@/lib/utils";
import {
  DEBT_STRATEGIES,
  simulatePayoff,
  type Debt,
  type DebtStrategy,
} from "../debts";
import { displayMoney, formatMoney } from "../format";
import { parseAmount } from "../rules";
import { useBudget } from "./budget-context";

/** Le mois où l'on sera libéré, à partir d'aujourd'hui. */
function monthAfter(today: string, months: number) {
  return new Date(
    Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1 + months),
  );
}

/**
 * Le plan pour finir ses dettes : avalanche ou boule de neige, et un montant de plus
 * chaque mois. Tout est calculé dans le téléphone, à partir des soldes, des taux et
 * des minimums des comptes.
 */
export function DebtPlanner({
  debts,
  suggestedCents,
}: {
  debts: Debt[];
  /** Ce qui reste chaque mois d'après le plan d'argent ; null s'il n'y en a pas. */
  suggestedCents: number | null;
}) {
  const t = useTranslations("Budget.debts");
  const format = useFormatter();
  const locale = useLocale();
  const id = useId();
  const { currency, today } = useBudget();
  const money = (cents: number) => formatMoney(format, cents, currency);
  const [strategy, setStrategy] = useState<DebtStrategy>("avalanche");
  const [extra, setExtra] = useState(
    suggestedCents
      ? amountText(Math.round(suggestedCents / 100), locale)
      : "100",
  );
  const extraCents = parseAmount(extra) ?? 0;
  const plan = simulatePayoff(debts, extraCents, strategy);
  const minimum = simulatePayoff(debts, 0, null);
  const saved = minimum.finished
    ? minimum.interestCents - plan.interestCents
    : null;
  const total = debts.reduce((sum, debt) => sum + debt.balanceCents, 0);
  const free = monthAfter(today, plan.months);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {t("total", { amount: money(total), count: debts.length })}
      </p>
      <div
        role="radiogroup"
        aria-label={t("strategy")}
        className="grid grid-cols-2 gap-2"
      >
        {DEBT_STRATEGIES.map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={strategy === value}
            onClick={() => setStrategy(value)}
            className={cn(
              "flex min-h-11 flex-col items-start gap-0.5 rounded-xl border p-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              strategy === value
                ? "border-primary bg-primary/10"
                : "border-foreground/10",
            )}
          >
            <span className="text-sm font-semibold">{t(`${value}.name`)}</span>
            <span className="text-xs text-pretty text-muted-foreground">
              {t(`${value}.text`)}
            </span>
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor={`${id}-extra`} className="text-sm font-semibold">
          {t("extra")}
        </label>
        <div className="flex items-center gap-3">
          <input
            id={`${id}-extra-range`}
            type="range"
            aria-label={t("extra")}
            min={0}
            max={2000}
            step={25}
            value={Math.min(extraCents / 100, 2000)}
            onChange={(event) =>
              setExtra(amountText(Number(event.target.value), locale))
            }
            className="h-11 min-w-0 flex-1 accent-primary"
          />
          <input
            id={`${id}-extra`}
            value={extra}
            onChange={(event) => setExtra(event.target.value)}
            inputMode="decimal"
            className="h-11 w-24 rounded-lg border border-input bg-transparent px-2 text-right tabular-nums outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>
        {suggestedCents ? (
          <p className="text-xs text-pretty text-muted-foreground">
            {t("fromPlan")}
          </p>
        ) : null}
      </div>

      {plan.finished ? (
        <div aria-live="polite" className="flex flex-col gap-1">
          <span className="caps-label text-muted-foreground">
            {t("freeOn")}
          </span>
          <span className="font-display text-5xl leading-none tracking-wide uppercase">
            {format.dateTime(free, {
              month: "long",
              year: "numeric",
              timeZone: "UTC",
            })}
          </span>
          <span className="text-sm">
            {t("summary", {
              months: plan.months,
              interest: displayMoney(money(plan.interestCents)),
            })}
          </span>
          {saved !== null && saved > 0 ? (
            <span className="text-sm font-semibold text-primary">
              {t("saves", {
                amount: money(saved),
                months: Math.max(minimum.months - plan.months, 0),
              })}
            </span>
          ) : null}
          <span className="text-sm text-pretty text-muted-foreground">
            {t("after", {
              amount: money(
                debts.reduce((sum, debt) => sum + debt.minimumCents, 0) +
                  extraCents,
              ),
            })}
          </span>
        </div>
      ) : (
        <p role="alert" className="text-sm font-medium">
          {t("never")}
        </p>
      )}

      {plan.finished ? (
        <ol className="flex flex-col">
          {plan.order.map((entry, index) => {
            const debt = debts.find((item) => item.id === entry.id);
            if (!debt) return null;
            return (
              <li
                key={entry.id}
                className="flex items-center gap-3 border-b border-foreground/8 py-2.5 last:border-b-0"
              >
                <span className="w-8 shrink-0 font-display text-2xl leading-none text-primary tabular-nums">
                  {index + 1}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-semibold">
                    {debt.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t("debtLine", {
                      amount: money(debt.balanceCents),
                      rate: debt.rateBp / 100,
                    })}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground first-letter:uppercase">
                  {format.dateTime(monthAfter(today, entry.month), {
                    month: "short",
                    year: "numeric",
                    timeZone: "UTC",
                  })}
                </span>
              </li>
            );
          })}
        </ol>
      ) : null}
      <p className="text-xs text-pretty text-muted-foreground">
        {t("estimate")}
      </p>
    </div>
  );
}

const amountText = (dollars: number, locale: string) =>
  locale === "fr" ? String(dollars).replace(".", ",") : String(dollars);
