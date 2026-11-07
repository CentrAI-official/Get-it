"use client";

import { Check } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { monthGrid } from "@/features/development/calendar";
import { toDbDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { formatMoney } from "../format";
import { useBudget } from "./budget-context";
import { INCOME_ICON, TRANSFER_ICON } from "../icons";
import { CategoryIcon } from "./category-icon";

export type CalendarBill = {
  day: string;
  label: string;
  amountCents: number;
  kind: string;
  category: string | null;
  paid: boolean;
};

const WEEK_DAYS = [
  "2024-01-01",
  "2024-01-02",
  "2024-01-03",
  "2024-01-04",
  "2024-01-05",
  "2024-01-06",
  "2024-01-07",
];

/** Le mois des factures : un point sous chaque jour de paiement, puis le détail du jour choisi. */
export function BillsCalendar({
  month,
  bills,
}: {
  month: string;
  bills: readonly CalendarBill[];
}) {
  const t = useTranslations("Budget.bills");
  const format = useFormatter();
  const { today, categories, currency } = useBudget();
  const inMonth = today.slice(0, 7) === month.slice(0, 7);
  const [selected, setSelected] = useState<string | null>(
    inMonth ? today : null,
  );
  const dayBills = (day: string) => bills.filter((bill) => bill.day === day);
  const shown = selected ? dayBills(selected) : bills;
  const sign = (bill: CalendarBill) =>
    bill.kind === "income"
      ? "income"
      : bill.kind === "expense"
        ? "expense"
        : undefined;

  return (
    <div className="flex flex-col gap-4">
      <div
        role="grid"
        aria-label={t("calendarLabel")}
        className="flex flex-col gap-1"
      >
        <div role="row" className="grid grid-cols-7">
          {WEEK_DAYS.map((day) => (
            <span
              key={day}
              role="columnheader"
              className="text-center text-xs font-medium text-muted-foreground capitalize"
            >
              {format.dateTime(toDbDate(day), {
                weekday: "narrow",
                timeZone: "UTC",
              })}
            </span>
          ))}
        </div>
        {monthGrid(month.slice(0, 7)).map((week, index) => (
          <div key={index} role="row" className="grid grid-cols-7 gap-1">
            {week.map((day, position) => {
              if (!day) {
                return <span key={position} role="gridcell" />;
              }
              const list = dayBills(day);
              const out = list.some((bill) => bill.kind !== "income");
              const label = format.dateTime(toDbDate(day), {
                weekday: "long",
                day: "numeric",
                month: "long",
                timeZone: "UTC",
              });
              return (
                <button
                  key={day}
                  type="button"
                  role="gridcell"
                  aria-selected={selected === day}
                  aria-label={
                    list.length > 0
                      ? t("dayLabel", { day: label, count: list.length })
                      : label
                  }
                  onClick={() => setSelected(selected === day ? null : day)}
                  className={cn(
                    "relative flex h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-sm font-semibold tabular-nums outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    selected === day
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-foreground/[0.05]",
                    selected !== day && day === today && "text-primary",
                  )}
                >
                  {Number(day.slice(8))}
                  <span
                    aria-hidden="true"
                    className={cn(
                      "size-1.5 rounded-full",
                      list.length === 0 && "invisible",
                      selected === day
                        ? "bg-primary-foreground"
                        : out
                          ? "bg-primary"
                          : "bg-foreground/40",
                    )}
                  />
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <section aria-live="polite" className="flex flex-col">
        <h3 className="pb-1 text-xs font-medium text-muted-foreground first-letter:uppercase">
          {selected
            ? format.dateTime(toDbDate(selected), {
                weekday: "long",
                day: "numeric",
                month: "long",
                timeZone: "UTC",
              })
            : t("allMonth")}
        </h3>
        {shown.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">{t("nothing")}</p>
        ) : (
          <ul className="flex flex-col">
            {shown.map((bill, index) => (
              <li
                key={`${bill.day}-${bill.label}-${index}`}
                className="flex items-center gap-3 border-b border-foreground/8 py-2.5 last:border-b-0"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-foreground/6">
                  {bill.kind === "income" ? (
                    <INCOME_ICON
                      aria-hidden="true"
                      className="size-[18px] text-muted-foreground"
                    />
                  ) : bill.kind === "transfer" ? (
                    <TRANSFER_ICON
                      aria-hidden="true"
                      className="size-[18px] text-muted-foreground"
                    />
                  ) : (
                    <CategoryIcon
                      category={bill.category}
                      categories={categories}
                      className="size-[18px] text-muted-foreground"
                    />
                  )}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">
                    {bill.label}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    {bill.paid ? (
                      <>
                        <Check aria-hidden="true" className="size-3" />
                        {t(bill.kind === "income" ? "received" : "paidOn", {
                          date: format.dateTime(toDbDate(bill.day), {
                            day: "numeric",
                            month: "short",
                            timeZone: "UTC",
                          }),
                        })}
                      </>
                    ) : (
                      t("dueOn", {
                        date: format.dateTime(toDbDate(bill.day), {
                          day: "numeric",
                          month: "short",
                          timeZone: "UTC",
                        }),
                      })
                    )}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-semibold tabular-nums">
                  {formatMoney(format, bill.amountCents, currency, sign(bill))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
