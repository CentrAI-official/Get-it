"use client";

import { ArrowLeftRight, Plus } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { envelopesOf, type Envelope, type SavingsEnvelope } from "../envelopes";
import { displayMoney, formatMoney } from "../format";
import type { MonthPlan } from "../plan";
import type { BudgetKind } from "../rules";
import { useBudget, useCategoryName } from "./budget-context";
import { EntryDialog } from "./budget-dialogs";
import { LineDialog } from "./envelope-dialogs";

// Les enveloppes (décision du fondateur, 2026-11-12, maquette 3) : une carte par
// catégorie de tous les jours, avec ce qui y reste, et l'épargne qui se remplit.

/** La période affichée, pour dire ce qui est sorti « cette semaine ». */
export type EnvelopePeriod = {
  view: "day" | "week";
  /** La période contient aujourd'hui. */
  current: boolean;
  /** Catégorie → ce qui est sorti pendant la période. */
  cents: Record<string, number>;
};

function useMoney() {
  const format = useFormatter();
  const { currency } = useBudget();
  return (cents: number) => formatMoney(format, cents, currency);
}

/** La barre d'une enveloppe : ce qui reste, en orange. */
function Bar({ share, inverse }: { share: number; inverse?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "block h-2 overflow-hidden rounded-full",
        inverse ? "bg-background/20" : "bg-foreground/8",
      )}
    >
      <span
        className={cn(
          "block h-full rounded-full",
          inverse ? "bg-background" : "bg-primary",
        )}
        style={{ width: `${Math.max(share * 100, share > 0 ? 3 : 0)}%` }}
      />
    </span>
  );
}

/** Ce qui est sorti pendant la période affichée (vues Jour et Semaine). */
function PeriodLine({
  period,
  category,
  inverse,
}: {
  period: EnvelopePeriod | null;
  category: string;
  inverse?: boolean;
}) {
  const t = useTranslations("Budget.envelopes");
  const money = useMoney();
  if (!period) return null;
  const key = `${period.view}${period.current ? "" : "Other"}` as const;
  const cents = period.cents[category] ?? 0;
  return (
    <span
      className={cn(
        "text-xs font-semibold tabular-nums",
        inverse ? "text-background" : "text-foreground",
      )}
    >
      {cents > 0
        ? t(`period.${key}`, { amount: money(cents) })
        : t(`periodNone.${key}`)}
    </span>
  );
}

function EnvelopeTile({
  envelope,
  period,
  onOpen,
}: {
  envelope: Envelope;
  period: EnvelopePeriod | null;
  onOpen: () => void;
}) {
  const t = useTranslations("Budget.envelopes");
  const nameOf = useCategoryName();
  const money = useMoney();
  const { state } = envelope;
  const flagged = state === "fast" || state === "over";
  const big =
    state === "unplanned"
      ? envelope.spentCents
      : state === "untouched"
        ? envelope.budgetCents
        : envelope.leftCents;
  const detail =
    state === "unplanned"
      ? t("unplanned")
      : state === "untouched"
        ? t("untouched")
        : state === "over"
          ? t("over", { amount: money(envelope.budgetCents) })
          : t("left", { amount: money(envelope.budgetCents) });

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "flex min-w-0 flex-col items-stretch gap-2 rounded-2xl border bg-raised p-3.5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        flagged
          ? "border-primary/45"
          : state === "unplanned"
            ? "border-dashed border-foreground/20"
            : "border-foreground/8",
      )}
    >
      <span className="flex min-w-0 items-baseline justify-between gap-2">
        <span className="truncate text-sm font-semibold">
          {nameOf(envelope.key)}
        </span>
        {flagged ? (
          <span className="shrink-0 text-[11px] font-bold text-primary">
            {t(state === "over" ? "overLabel" : "fast")}
          </span>
        ) : null}
      </span>
      <span className="font-display text-[2.125rem] leading-none tracking-wide whitespace-nowrap tabular-nums">
        {displayMoney(money(big))}
      </span>
      <span className="text-xs text-muted-foreground tabular-nums">
        {detail}
      </span>
      {state === "unplanned" ? null : <Bar share={envelope.share} />}
      <PeriodLine period={period} category={envelope.key} />
    </button>
  );
}

/** L'épargne : une carte à l'encre, qui se remplit au lieu de se vider. */
function SavingsTile({
  savings,
  period,
  onOpen,
}: {
  savings: SavingsEnvelope;
  period: EnvelopePeriod | null;
  onOpen: () => void;
}) {
  const t = useTranslations("Budget.envelopes");
  const nameOf = useCategoryName();
  const money = useMoney();
  const planned = savings.budgetCents > 0;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-w-0 flex-col items-stretch gap-2 rounded-2xl border border-foreground/8 bg-foreground p-3.5 text-left text-background outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span className="truncate text-sm font-semibold">
        {nameOf("savings")}
      </span>
      <span className="font-display text-[2.125rem] leading-none tracking-wide whitespace-nowrap tabular-nums">
        {displayMoney(
          money(
            planned && !savings.reached
              ? savings.leftCents
              : savings.savedCents,
          ),
        )}
      </span>
      <span className="text-xs text-background/75 tabular-nums">
        {!planned
          ? t("savingsFree")
          : savings.reached
            ? t("savingsReached")
            : t("savingsLeft", {
                saved: money(savings.savedCents),
                budget: money(savings.budgetCents),
              })}
      </span>
      {planned ? <Bar share={savings.share} inverse /> : null}
      <PeriodLine period={period} category="savings" inverse />
    </button>
  );
}

/**
 * Les cartes des enveloppes, dans la grille de la page (les paiements fixes, les
 * dettes et les objectifs s'y ajoutent). Toucher une enveloppe ouvre son montant,
 * son report et « Ajouter une dépense ».
 */
export function EnvelopeTiles({
  plan,
  month,
  elapsed,
  period,
  showEmpty,
}: {
  plan: MonthPlan;
  /** Le 1er jour du mois. */
  month: string;
  elapsed: number;
  period: EnvelopePeriod | null;
  /** Sans enveloppe : une phrase pour dire quoi faire (vue Mois). */
  showEmpty: boolean;
}) {
  const t = useTranslations("Budget.envelopes");
  const [open, setOpen] = useState<string | null>(null);
  const [spending, setSpending] = useState<string | null>(null);
  const { envelopes, savings } = envelopesOf(plan, elapsed);
  const line =
    plan.groups
      .flatMap((group) => group.lines)
      .find((entry) => entry.key === open) ?? null;

  return (
    <>
      {envelopes.length === 0 && !savings && showEmpty ? (
        <p className="col-span-2 rounded-2xl border border-dashed border-foreground/15 p-4 text-sm text-pretty text-muted-foreground">
          {t("empty")}
        </p>
      ) : null}
      {envelopes.map((envelope) => (
        <EnvelopeTile
          key={envelope.key}
          envelope={envelope}
          period={period}
          onOpen={() => setOpen(envelope.key)}
        />
      ))}
      {savings ? (
        <SavingsTile
          savings={savings}
          period={period}
          onOpen={() => setOpen("savings")}
        />
      ) : null}
      {line ? (
        <LineDialog
          key={line.key}
          line={line}
          month={month}
          onClose={() => setOpen(null)}
          onSpend={() => {
            setOpen(null);
            setSpending(line.key);
          }}
        />
      ) : null}
      {spending ? (
        <EntryDialog
          open
          onOpenChange={(value) => (value ? null : setSpending(null))}
          entry={null}
          kind="expense"
          category={spending}
        />
      ) : null}
    </>
  );
}

/**
 * « Dépense rapide » : on touche l'enveloppe, on tape le montant. Le revenu et
 * le virement sont à côté.
 */
export function QuickSpend({
  plan,
  elapsed,
}: {
  plan: MonthPlan;
  elapsed: number;
}) {
  const t = useTranslations("Budget.envelopes.quick");
  const nameOf = useCategoryName();
  const { accounts } = useBudget();
  const [quick, setQuick] = useState<string | null>(null);
  const [kind, setKind] = useState<BudgetKind | null>(null);
  const { envelopes } = envelopesOf(plan, elapsed);
  const chip =
    "flex h-11 shrink-0 items-center gap-1.5 rounded-full border border-foreground/15 px-4 text-sm font-medium outline-none hover:bg-foreground/5 focus-visible:ring-3 focus-visible:ring-ring/50";

  return (
    <section
      aria-labelledby="budget-quick"
      className="flex flex-col gap-3 border-t border-foreground/8 pt-6"
    >
      <div className="flex flex-col gap-1">
        <h2 id="budget-quick" className="caps-label text-muted-foreground">
          {t("title")}
        </h2>
        <p className="text-sm text-pretty text-muted-foreground">{t("hint")}</p>
      </div>
      <div className="-mx-4 flex [scrollbar-width:none] gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden">
        {envelopes.map((envelope) => (
          <button
            key={envelope.key}
            type="button"
            onClick={() => setQuick(envelope.key)}
            className={chip}
          >
            {nameOf(envelope.key)}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setKind("expense")}
          className={chip}
        >
          <Plus aria-hidden="true" className="size-4" />
          {envelopes.length > 0 ? t("other") : t("expense")}
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          className="h-11"
          onClick={() => setKind("income")}
        >
          <Plus aria-hidden="true" />
          {t("income")}
        </Button>
        {accounts.length >= 2 ? (
          <Button
            variant="outline"
            className="h-11"
            onClick={() => setKind("transfer")}
          >
            <ArrowLeftRight aria-hidden="true" />
            {t("transfer")}
          </Button>
        ) : null}
      </div>
      {quick ? (
        <EntryDialog
          open
          onOpenChange={(value) => (value ? null : setQuick(null))}
          entry={null}
          kind="expense"
          category={quick}
        />
      ) : null}
      {kind ? (
        <EntryDialog
          open
          onOpenChange={(value) => (value ? null : setKind(null))}
          entry={null}
          kind={kind}
        />
      ) : null}
    </section>
  );
}
