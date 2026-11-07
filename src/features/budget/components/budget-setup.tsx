"use client";

import { ArrowLeft, ArrowRight, LoaderCircle, Sparkles } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { setupBudgetAction } from "../budget-actions";
import { CATEGORY_GROUPS } from "../categories";
import { amountField, displayMoney, formatMoney } from "../format";
import { CATEGORY_ICONS } from "../icons";
import { suggestPlan } from "../plan";
import { parseAmount, type BudgetError } from "../rules";
import { COMMON_BILLS, monthlyIncome, SETUP_FREQUENCIES } from "../setup";
import { useBudget, useCategoryName } from "./budget-context";

type Frequency = (typeof SETUP_FREQUENCIES)[number];
type BillKey = (typeof COMMON_BILLS)[number]["key"];

const STEPS = 3;

/**
 * La mise en route : son revenu, ses paiements fixes, puis une première répartition
 * à ajuster. Un budget utile en deux minutes, sans rien lier à la banque.
 */
export function BudgetSetupButton() {
  const t = useTranslations("Budget.setup");
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button className="h-12 px-6 text-base" onClick={() => setOpen(true)}>
        {t("start")}
      </Button>
      {open ? <SetupDialog onClose={() => setOpen(false)} /> : null}
    </>
  );
}

/** Le jour du paiement, dans le mois en cours. */
function dayInMonth(today: string, day: number) {
  const last = new Date(
    Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0),
  ).getUTCDate();
  return `${today.slice(0, 8)}${String(Math.min(day, last)).padStart(2, "0")}`;
}

function SetupDialog({ onClose }: { onClose: () => void }) {
  const t = useTranslations("Budget.setup");
  const tErrors = useTranslations("Budget.errors");
  const tFrequencies = useTranslations("Budget.frequencies");
  const format = useFormatter();
  const locale = useLocale();
  const router = useRouter();
  const id = useId();
  const nameOf = useCategoryName();
  const { today, currency } = useBudget();
  const money = (cents: number) => formatMoney(format, cents, currency);

  const [step, setStep] = useState(0);
  const [pay, setPay] = useState("");
  const [frequency, setFrequency] = useState<Frequency>("biweekly");
  const [payDate, setPayDate] = useState(today);
  const [bills, setBills] = useState<
    Partial<Record<BillKey, { amount: string; day: string }>>
  >({});
  const [plans, setPlans] = useState<Record<string, string>>({});
  const [error, setError] = useState<BudgetError | null>(null);
  const [pending, startTransition] = useTransition();

  const payCents = parseAmount(pay);
  const incomeCents = payCents ? monthlyIncome(payCents, frequency) : 0;
  const filled = COMMON_BILLS.flatMap((bill) => {
    const entry = bills[bill.key];
    const cents = entry ? parseAmount(entry.amount) : null;
    return cents ? [{ bill, cents, day: Number(entry?.day) || 1 }] : [];
  });

  function nextStep() {
    setError(null);
    if (step === 0 && !payCents) {
      setError("amountInvalid");
      return;
    }
    if (step === 1) {
      // La proposition 50/30/20, une fois les paiements fixes connus
      const suggestion = suggestPlan(
        incomeCents,
        filled.map(({ bill, cents }) => ({
          group: CATEGORY_GROUPS[bill.category],
          cents,
        })),
      );
      setPlans(
        Object.fromEntries(
          suggestion.map((item) => [
            item.category,
            amountField(item.cents, locale),
          ]),
        ),
      );
    }
    setStep((current) => current + 1);
  }

  function finish() {
    setError(null);
    const planItems = Object.entries(plans).flatMap(([category, value]) => {
      const amountCents = parseAmount(value);
      return amountCents ? [{ category, amountCents }] : [];
    });
    startTransition(async () => {
      const result = await setupBudgetAction({
        income: {
          label: t("incomeName"),
          amountCents: payCents,
          frequency,
          startsOn: payDate,
        },
        bills: filled.map(({ bill, cents, day }) => ({
          label: t(`bills.${bill.key}`),
          category: bill.category,
          amountCents: cents,
          startsOn: dayInMonth(today, day),
        })),
        plans: planItems,
      });
      if (result.ok) {
        onClose();
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  const plannedCents = Object.values(plans).reduce(
    (sum, value) => sum + (parseAmount(value) ?? 0),
    0,
  );
  const fixedCents = filled.reduce((sum, { cents }) => sum + cents, 0);
  const leftCents = incomeCents - fixedCents - plannedCents;

  return (
    <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent
        closeLabel={t("close")}
        className="inset-0 top-0 left-0 flex h-dvh max-h-dvh w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-y-auto overscroll-contain rounded-none p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] ring-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:h-[min(44rem,calc(100dvh-4rem))] sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:p-6 sm:ring-1"
      >
        <DialogTitle className="sr-only">{t("title")}</DialogTitle>
        <DialogDescription className="sr-only">
          {t("description")}
        </DialogDescription>
        <div
          role="progressbar"
          aria-label={t("progressLabel")}
          aria-valuemin={1}
          aria-valuemax={STEPS}
          aria-valuenow={step + 1}
          className="mr-12 flex gap-1.5"
        >
          {Array.from({ length: STEPS }, (_, index) => (
            <span
              key={index}
              className={cn(
                "h-1.5 flex-1 rounded-full",
                index <= step ? "bg-primary" : "bg-foreground/10",
              )}
            />
          ))}
        </div>

        <div className="flex flex-1 flex-col gap-5 py-8">
          {step === 0 ? (
            <>
              <h2 className="font-display text-4xl leading-none tracking-wide text-balance uppercase">
                {t("incomeTitle")}
              </h2>
              <p className="text-pretty text-muted-foreground">
                {t("incomeText")}
              </p>
              <div className="flex flex-col gap-2">
                <label htmlFor={`${id}-pay`} className="text-sm font-semibold">
                  {t("incomeAmount")}
                </label>
                <div className="relative">
                  <Input
                    id={`${id}-pay`}
                    value={pay}
                    onChange={(event) => setPay(event.target.value)}
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="0"
                    aria-invalid={error ? true : undefined}
                    className="h-14 pr-9 font-display text-3xl tracking-wide tabular-nums"
                  />
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xl text-muted-foreground"
                  >
                    $
                  </span>
                </div>
              </div>
              <div
                role="radiogroup"
                aria-label={t("incomeFrequency")}
                className="flex flex-wrap gap-2"
              >
                {SETUP_FREQUENCIES.map((value) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={frequency === value}
                    onClick={() => setFrequency(value)}
                    className={cn(
                      "min-h-11 rounded-full border px-4 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      frequency === value
                        ? "border-primary bg-primary/15"
                        : "border-foreground/10 text-muted-foreground",
                    )}
                  >
                    {tFrequencies(value)}
                  </button>
                ))}
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor={`${id}-date`} className="text-sm font-semibold">
                  {t("incomeDate")}
                </label>
                <Input
                  id={`${id}-date`}
                  type="date"
                  value={payDate}
                  onChange={(event) => setPayDate(event.target.value)}
                  className="h-11 w-auto"
                />
              </div>
              {incomeCents > 0 ? (
                <p className="text-sm font-semibold text-primary">
                  {t("incomeMonthly", { amount: money(incomeCents) })}
                </p>
              ) : null}
            </>
          ) : step === 1 ? (
            <>
              <h2 className="font-display text-4xl leading-none tracking-wide text-balance uppercase">
                {t("billsTitle")}
              </h2>
              <p className="text-pretty text-muted-foreground">
                {t("billsText")}
              </p>
              <ul className="flex flex-col">
                {COMMON_BILLS.map((bill) => {
                  const Icon = CATEGORY_ICONS[bill.category];
                  const entry = bills[bill.key];
                  const label = t(`bills.${bill.key}`);
                  return (
                    <li
                      key={bill.key}
                      className="flex items-center gap-3 border-b border-foreground/8 py-2 last:border-b-0"
                    >
                      <Icon
                        aria-hidden="true"
                        className="size-5 shrink-0 text-muted-foreground"
                      />
                      <span className="min-w-0 flex-1 text-sm font-medium">
                        {label}
                      </span>
                      <Input
                        aria-label={t("billAmount", { bill: label })}
                        value={entry?.amount ?? ""}
                        onChange={(event) =>
                          setBills((current) => ({
                            ...current,
                            [bill.key]: {
                              amount: event.target.value,
                              day: entry?.day ?? "1",
                            },
                          }))
                        }
                        inputMode="decimal"
                        autoComplete="off"
                        placeholder="0 $"
                        className="h-11 w-24 text-right tabular-nums"
                      />
                      <Input
                        aria-label={t("billDay", { bill: label })}
                        value={entry?.day ?? ""}
                        onChange={(event) =>
                          setBills((current) => ({
                            ...current,
                            [bill.key]: {
                              amount: entry?.amount ?? "",
                              day: event.target.value
                                .replace(/\D/g, "")
                                .slice(0, 2),
                            },
                          }))
                        }
                        inputMode="numeric"
                        placeholder={t("dayPlaceholder")}
                        className="h-11 w-14 text-center tabular-nums"
                      />
                    </li>
                  );
                })}
              </ul>
              <p className="text-xs text-pretty text-muted-foreground">
                {t("billsHint")}
              </p>
            </>
          ) : (
            <>
              <h2 className="font-display text-4xl leading-none tracking-wide text-balance uppercase">
                {t("planTitle")}
              </h2>
              <p className="flex items-start gap-2 text-sm text-pretty text-muted-foreground">
                <Sparkles
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 text-primary"
                />
                {t("planText")}
              </p>
              <div className="flex flex-col gap-0.5">
                <span className="caps-label text-muted-foreground">
                  {t("planLeft")}
                </span>
                <span
                  className={cn(
                    "font-display text-5xl leading-none tracking-wide tabular-nums",
                    leftCents < 0 && "text-primary",
                  )}
                >
                  {displayMoney(money(leftCents))}
                </span>
              </div>
              <ul className="flex flex-col">
                {Object.entries(plans).map(([category, value]) => (
                  <li
                    key={category}
                    className="flex items-center gap-3 border-b border-foreground/8 py-2 last:border-b-0"
                  >
                    <span className="min-w-0 flex-1 text-sm font-medium">
                      {nameOf(category)}
                    </span>
                    <Input
                      aria-label={t("planAmount", {
                        category: nameOf(category),
                      })}
                      value={value}
                      onChange={(event) =>
                        setPlans((current) => ({
                          ...current,
                          [category]: event.target.value,
                        }))
                      }
                      inputMode="decimal"
                      autoComplete="off"
                      className="h-11 w-28 text-right tabular-nums"
                    />
                  </li>
                ))}
              </ul>
              {Object.keys(plans).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("planEmpty")}
                </p>
              ) : null}
            </>
          )}
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {tErrors(error)}
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            className="h-11"
            disabled={step === 0}
            onClick={() => setStep((current) => current - 1)}
          >
            <ArrowLeft aria-hidden="true" />
            {t("previous")}
          </Button>
          {step < STEPS - 1 ? (
            <Button className="h-12 px-5" onClick={nextStep}>
              {t("next")}
              <ArrowRight aria-hidden="true" />
            </Button>
          ) : (
            <Button className="h-12 px-5" disabled={pending} onClick={finish}>
              {pending ? (
                <LoaderCircle aria-hidden="true" className="animate-spin" />
              ) : null}
              {t("finish")}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
