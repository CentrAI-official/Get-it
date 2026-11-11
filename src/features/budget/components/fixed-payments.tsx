"use client";

import { Check, LoaderCircle, Minus } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useId, useOptimistic, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { daysBetween, toDbDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { setFixedPaymentAction } from "../budget-actions";
import {
  occurrenceKey,
  type FixedAction,
  type FixedPayment,
  type FixedState,
} from "../checklist";
import { amountField, displayMoney, formatMoney } from "../format";
import { parseAmount, type BudgetError, type UpcomingItem } from "../rules";
import { useBudget } from "./budget-context";
import { PayDialog } from "./pay-check";

// Les paiements fixes du mois (décision du fondateur, 2026-11-10) : pas de
// barre, une case à cocher quand c'est payé. Toucher la ligne permet de changer
// le montant pour cette fois, ou de dire « pas ce mois-ci ».

const keyOf = (item: { recurringId: string; day: string }) =>
  occurrenceKey(item.recurringId, item.day);

type Change = { key: string; state: FixedState; paidCents: number | null };

function useMoney() {
  const format = useFormatter();
  const { currency } = useBudget();
  return (cents: number) => formatMoney(format, cents, currency);
}

/** L'état d'un paiement remis à payer : arrivé ou à venir. */
const openState = (day: string, today: string): FixedState =>
  day <= today ? "due" : "upcoming";

/** La case : un rond qui se remplit d'orange une fois payé. */
function CheckButton({
  item,
  label,
  onToggle,
}: {
  item: FixedPayment;
  label: string;
  onToggle: () => void;
}) {
  const paid = item.state === "paid";
  // Jamais désactivée pendant un enregistrement : on coche plusieurs paiements
  // de suite (Next envoie les actions une à une, dans l'ordre)
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={paid}
      aria-label={label}
      onClick={onToggle}
      className="group flex size-11 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span
        className={cn(
          "flex size-6 items-center justify-center rounded-full border-2 transition-colors",
          paid
            ? "border-primary bg-primary text-primary-foreground"
            : item.state === "skipped"
              ? "border-dashed border-foreground/30 text-muted-foreground"
              : "border-foreground/30 group-hover:border-foreground/60",
        )}
      >
        {paid ? (
          <Check aria-hidden="true" className="size-4" strokeWidth={3} />
        ) : item.state === "skipped" ? (
          <Minus aria-hidden="true" className="size-3.5" />
        ) : null}
      </span>
    </button>
  );
}

function PaymentRow({
  item,
  onToggle,
  onOpen,
}: {
  item: FixedPayment;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const t = useTranslations("Budget.fixedPayments");
  const format = useFormatter();
  const money = useMoney();
  const { today } = useBudget();
  const date = toDbDate(item.day);
  const days = daysBetween(today, item.day);
  const status =
    item.state === "paid"
      ? t("paid")
      : item.state === "skipped"
        ? t("skipped")
        : item.state === "due"
          ? days === 0
            ? t("today")
            : t("due")
          : days === 1
            ? t("tomorrow")
            : t("inDays", { days });
  const settled = item.state === "paid" || item.state === "skipped";
  const shown = item.paidCents ?? item.plannedCents;

  return (
    <li className="flex items-center gap-1 border-b border-foreground/8 last:border-b-0">
      <CheckButton
        item={item}
        onToggle={onToggle}
        label={t("checkLabel", {
          label: item.label,
          date: format.dateTime(date, {
            day: "numeric",
            month: "long",
            timeZone: "UTC",
          }),
        })}
      />
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-3 py-2.5 pr-1 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {/* Le jour en grand, son mois dessous, comme une page de calendrier */}
        <span className="flex w-9 shrink-0 flex-col items-center">
          <span
            className={cn(
              "font-display text-xl leading-none tracking-wide tabular-nums",
              settled && "text-muted-foreground",
            )}
          >
            {format.dateTime(date, { day: "numeric", timeZone: "UTC" })}
          </span>
          <span className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
            {format.dateTime(date, { month: "short", timeZone: "UTC" })}
          </span>
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span
            className={cn(
              "truncate text-sm font-semibold",
              settled && "text-muted-foreground",
            )}
          >
            {item.label}
          </span>
          <span
            className={cn(
              "text-xs",
              item.state === "due"
                ? "font-medium text-foreground"
                : "text-muted-foreground",
            )}
          >
            {status}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end">
          <span
            className={cn(
              "text-sm font-semibold tabular-nums",
              item.state === "skipped" && "text-muted-foreground line-through",
            )}
          >
            {money(shown)}
          </span>
          {item.paidCents !== null && item.paidCents !== item.plannedCents ? (
            <span className="text-xs text-muted-foreground tabular-nums">
              {t("planned", { amount: money(item.plannedCents) })}
            </span>
          ) : null}
        </span>
      </button>
    </li>
  );
}

/** Un paiement : le montant payé cette fois, « pas ce mois-ci », ou de nouveau à payer. */
function PaymentDialog({
  item,
  onSave,
  onClose,
}: {
  item: FixedPayment;
  onSave: (action: FixedAction, amount?: string) => Promise<boolean>;
  onClose: () => void;
}) {
  const t = useTranslations("Budget.fixedPayments.dialog");
  const tErrors = useTranslations("Budget.errors");
  const format = useFormatter();
  const locale = useLocale();
  const id = useId();
  const money = useMoney();
  const [amount, setAmount] = useState(
    amountField(item.paidCents ?? item.plannedCents, locale),
  );
  const [error, setError] = useState<BudgetError | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: FixedAction) {
    setError(null);
    if (action === "paid" && parseAmount(amount) === null) {
      setError("amountInvalid");
      return;
    }
    startTransition(async () => {
      if (await onSave(action, action === "paid" ? amount : undefined)) {
        onClose();
      } else setError("unexpected");
    });
  }

  return (
    <Dialog open onOpenChange={(open) => (open || pending ? null : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item.label}</DialogTitle>
          <DialogDescription className="first-letter:uppercase">
            {t("description", {
              date: format.dateTime(toDbDate(item.day), {
                weekday: "long",
                day: "numeric",
                month: "long",
                timeZone: "UTC",
              }),
            })}
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            run("paid");
          }}
        >
          <div className="flex flex-col gap-2">
            <label htmlFor={`${id}-amount`} className="text-sm font-semibold">
              {t("amount")}
            </label>
            <div className="relative">
              <Input
                id={`${id}-amount`}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                inputMode="decimal"
                autoComplete="off"
                aria-invalid={error ? true : undefined}
                aria-describedby={`${id}-hint`}
                className="h-12 pr-9 font-display text-2xl tracking-wide tabular-nums"
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-lg text-muted-foreground"
              >
                $
              </span>
            </div>
            <p id={`${id}-hint`} className="text-xs text-muted-foreground">
              {t("amountHint", { amount: money(item.plannedCents) })}
            </p>
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {tErrors(error)}
              </p>
            ) : null}
          </div>
          <DialogFooter className="gap-2">
            {item.state === "paid" || item.state === "skipped" ? (
              <Button
                type="button"
                variant="ghost"
                className="h-11 text-muted-foreground sm:mr-auto"
                disabled={pending}
                onClick={() => run("open")}
              >
                {t("reopen")}
              </Button>
            ) : null}
            {item.state === "skipped" ? null : (
              <Button
                type="button"
                variant="outline"
                className="h-11"
                disabled={pending}
                onClick={() => run("skipped")}
              >
                {t("skip")}
              </Button>
            )}
            <Button type="submit" className="h-11" disabled={pending}>
              {pending ? (
                <LoaderCircle aria-hidden="true" className="animate-spin" />
              ) : null}
              {item.state === "paid" ? t("save") : t("paid")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * « Paiements fixes » de la vue Mois : les paies à confirmer, les oublis du mois
 * passé, puis chaque dépense et virement fixe du mois, à cocher.
 */
export function FixedPaymentsSection({
  fixed,
  leftover,
  pays,
}: {
  fixed: FixedPayment[];
  leftover: FixedPayment[];
  pays: UpcomingItem[];
}) {
  const t = useTranslations("Budget.fixedPayments");
  const format = useFormatter();
  const money = useMoney();
  const { today, currency } = useBudget();
  const [items, apply] = useOptimistic(
    [...leftover, ...fixed],
    (current, change: Change) =>
      current.map((item) =>
        keyOf(item) === change.key
          ? { ...item, state: change.state, paidCents: change.paidCents }
          : item,
      ),
  );
  const [opened, setOpened] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<UpcomingItem | null>(null);
  const [failed, setFailed] = useState(false);
  const [, startTransition] = useTransition();

  if (items.length === 0 && pays.length === 0) return null;

  const thisMonth = items.slice(leftover.length);
  const lastMonth = items.slice(0, leftover.length);
  const paidCount = thisMonth.filter((item) => item.state === "paid").length;
  const counted = thisMonth.filter((item) => item.state !== "skipped");
  const leftCents = counted
    .filter((item) => item.state !== "paid")
    .reduce((sum, item) => sum + item.plannedCents, 0);
  const openedItem = items.find((item) => keyOf(item) === opened) ?? null;

  /** Enregistre un changement, affiché tout de suite. */
  async function save(
    item: FixedPayment,
    action: FixedAction,
    amount?: string,
  ) {
    const cents = amount ? parseAmount(amount) : null;
    apply({
      key: keyOf(item),
      state:
        action === "paid"
          ? "paid"
          : action === "skipped"
            ? "skipped"
            : openState(item.day, today),
      paidCents: action === "paid" ? (cents ?? item.plannedCents) : null,
    });
    const result = await setFixedPaymentAction({
      recurringId: item.recurringId,
      day: item.day,
      action,
      amount,
    });
    return result.ok;
  }

  function toggle(item: FixedPayment) {
    setFailed(false);
    startTransition(async () => {
      const ok = await save(item, item.state === "paid" ? "open" : "paid");
      if (!ok) setFailed(true);
    });
  }

  const renderList = (list: FixedPayment[]) => (
    <ul className="flex flex-col">
      {list.map((item) => (
        <PaymentRow
          key={keyOf(item)}
          item={item}
          onToggle={() => toggle(item)}
          onOpen={() => setOpened(keyOf(item))}
        />
      ))}
    </ul>
  );

  return (
    <section
      aria-labelledby="budget-fixed"
      className="flex flex-col gap-3 border-t border-foreground/8 pt-6"
    >
      <div className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="budget-fixed" className="caps-label text-muted-foreground">
            {t("title")}
          </h2>
          {counted.length > 0 ? (
            <span className="text-xs text-muted-foreground tabular-nums">
              {t("count", { paid: paidCount, count: counted.length })}
            </span>
          ) : null}
        </div>
        {counted.length > 0 ? (
          leftCents > 0 ? (
            <p className="text-sm font-semibold">
              {t("left", { amount: displayMoney(money(leftCents)) })}
            </p>
          ) : (
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <Check aria-hidden="true" className="size-4 text-primary" />
              {t("allPaid")}
            </p>
          )
        ) : null}
        <p className="text-xs text-pretty text-muted-foreground">{t("hint")}</p>
      </div>

      {pays.length > 0 ? (
        <div className="flex flex-col gap-1">
          <h3 className="text-xs font-semibold text-muted-foreground">
            {t("paysTitle")}
          </h3>
          <ul className="flex flex-col">
            {pays.map((pay) => (
              <li
                key={keyOf(pay)}
                className="flex items-center gap-3 border-b border-foreground/8 py-2 last:border-b-0"
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-semibold">
                    {pay.label}
                  </span>
                  <span className="text-xs text-muted-foreground first-letter:uppercase">
                    {format.dateTime(toDbDate(pay.day), {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      timeZone: "UTC",
                    })}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-semibold tabular-nums">
                  {formatMoney(format, pay.amountCents, currency, "income")}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-10 shrink-0"
                  onClick={() => setConfirming(pay)}
                >
                  {t("confirm")}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {lastMonth.length > 0 ? (
        <div className="flex flex-col">
          <h3 className="text-xs font-semibold text-muted-foreground">
            {t("lastMonth")}
          </h3>
          {renderList(lastMonth)}
        </div>
      ) : null}

      {thisMonth.length > 0 ? renderList(thisMonth) : null}

      {failed ? (
        <p role="alert" className="text-sm text-destructive">
          {t("error")}
        </p>
      ) : null}

      {openedItem ? (
        <PaymentDialog
          key={keyOf(openedItem)}
          item={openedItem}
          onClose={() => setOpened(null)}
          // Appelé dans la transition de la fenêtre : l'affichage suit tout de suite
          onSave={(action, amount) => save(openedItem, action, amount)}
        />
      ) : null}
      {confirming ? (
        <PayDialog
          key={keyOf(confirming)}
          pay={confirming}
          currency={currency}
          onClose={() => setConfirming(null)}
        />
      ) : null}
    </section>
  );
}
