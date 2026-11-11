"use client";

import { LoaderCircle } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import {
  useId,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
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
import { toDbDate } from "@/lib/dates";
import { setFixedPaymentAction } from "../budget-actions";
import { occurrenceKey } from "../checklist";
import { amountField, displayMoney, formatMoney } from "../format";
import { parseAmount, type BudgetError, type UpcomingItem } from "../rules";

// « As-tu reçu ta paie? » (décision du fondateur, 2026-11-10) : le jour de la
// paie, en ouvrant le budget, on confirme le montant reçu, pour cette paie
// seulement (une semaine à moins d'heures), ou on dit qu'elle n'est pas arrivée.

const LATER_KEY = "budget-pay-later";

// Les paies remises à plus tard pendant la visite, et la page qui montre la
// fenêtre : Next garde les onglets quittés cachés, un seul la montre à la fois.
const later = new Set<string>();
let owner: string | null = null;
let version = 0;
const listeners = new Set<() => void>();

function emit() {
  version += 1;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function readLater() {
  try {
    const raw = sessionStorage.getItem(LATER_KEY);
    if (raw) for (const key of JSON.parse(raw) as string[]) later.add(key);
  } catch {
    // Navigation privée : « Plus tard » ne vaut que pour cette page
  }
}

function saveLater() {
  try {
    sessionStorage.setItem(LATER_KEY, JSON.stringify([...later]));
  } catch {
    // Idem
  }
}

const keyOf = (pay: UpcomingItem) => occurrenceKey(pay.recurringId, pay.day);

/** Une paie à confirmer : le montant reçu, ou « Pas reçue ». */
export function PayDialog({
  pay,
  currency,
  position,
  onClose,
  later: onLater,
}: {
  pay: UpcomingItem;
  currency: string;
  /** « 2 sur 3 » quand plusieurs paies attendent. */
  position?: { index: number; count: number };
  /** Après une réponse enregistrée (ou en fermant, sans « Plus tard »). */
  onClose?: () => void;
  /** « Plus tard » : la fenêtre revient à la prochaine visite. */
  later?: () => void;
}) {
  const t = useTranslations("Budget.payCheck");
  const tErrors = useTranslations("Budget.errors");
  const format = useFormatter();
  const locale = useLocale();
  const id = useId();
  const money = (cents: number) => formatMoney(format, cents, currency);
  const [amount, setAmount] = useState(amountField(pay.amountCents, locale));
  const [error, setError] = useState<BudgetError | null>(null);
  const [pending, startTransition] = useTransition();
  const cents = parseAmount(amount);
  const changed = cents !== null && cents !== pay.amountCents;

  function answer(action: "paid" | "skipped") {
    setError(null);
    if (action === "paid" && cents === null) {
      setError("amountInvalid");
      return;
    }
    startTransition(async () => {
      const result = await setFixedPaymentAction({
        recurringId: pay.recurringId,
        day: pay.day,
        action,
        amount: action === "paid" ? amount : undefined,
      });
      if (!result.ok) setError(result.error);
      else onClose?.();
    });
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (open || pending) return;
        if (onLater) onLater();
        else onClose?.();
      }}
    >
      <DialogContent closeLabel={t("close")}>
        <DialogHeader>
          {position && position.count > 1 ? (
            <p className="caps-label text-muted-foreground">
              {t("position", position)}
            </p>
          ) : null}
          <DialogTitle>
            {t("title", {
              label: pay.label,
              date: format.dateTime(toDbDate(pay.day), {
                day: "numeric",
                month: "long",
                timeZone: "UTC",
              }),
            })}
          </DialogTitle>
          <DialogDescription>
            {t("question", { amount: money(pay.amountCents) })}
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            answer("paid");
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
                className="h-14 pr-9 font-display text-3xl tracking-wide tabular-nums"
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-lg text-muted-foreground"
              >
                $
              </span>
            </div>
            <p id={`${id}-hint`} className="text-xs text-muted-foreground">
              {t("hint", { amount: money(pay.amountCents) })}
            </p>
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {tErrors(error)}
              </p>
            ) : null}
          </div>
          <DialogFooter className="gap-2">
            {onLater ? (
              <Button
                type="button"
                variant="ghost"
                className="h-11 text-muted-foreground sm:mr-auto"
                disabled={pending}
                onClick={onLater}
              >
                {t("later")}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              className="h-11"
              disabled={pending}
              onClick={() => answer("skipped")}
            >
              {t("notReceived")}
            </Button>
            <Button type="submit" className="h-11" disabled={pending}>
              {pending ? (
                <LoaderCircle aria-hidden="true" className="animate-spin" />
              ) : null}
              {changed
                ? t("save", { amount: displayMoney(money(cents)) })
                : t("yes")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * La fenêtre qui s'ouvre toute seule en ouvrant le budget, une paie à la fois,
 * la plus ancienne d'abord. « Plus tard » la remet à la prochaine visite.
 */
export function PayCheck({
  pays,
  currency,
}: {
  pays: UpcomingItem[];
  currency: string;
}) {
  const id = useId();
  useSyncExternalStore(
    subscribe,
    () => version,
    () => -1,
  );
  const [total] = useState(pays.length);

  // Seulement la page affichée : une page quittée (cachée par Next) la rend
  useLayoutEffect(() => {
    readLater();
    owner = id;
    emit();
    return () => {
      if (owner === id) {
        owner = null;
        emit();
      }
    };
  }, [id]);

  const waiting = pays.filter((pay) => !later.has(keyOf(pay)));
  const pay = waiting[0];
  if (owner !== id || !pay) return null;
  const count = Math.max(total, waiting.length);
  return (
    <PayDialog
      key={keyOf(pay)}
      pay={pay}
      currency={currency}
      position={{ index: count - waiting.length + 1, count }}
      later={() => {
        for (const item of waiting) later.add(keyOf(item));
        saveLater();
        emit();
      }}
    />
  );
}
