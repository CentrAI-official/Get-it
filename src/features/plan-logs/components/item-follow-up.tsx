"use client";

import { Check, Wallet, X } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { amountField, formatMoney } from "@/features/budget/format";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import {
  OUTCOMES,
  PLAN_LOG_LIMITS,
  savingsActionOf,
  type PlanLogRow,
} from "../rules";
import type { LogTarget, PlanLogControls } from "./use-plan-logs";

/** Le bouton rond qui coche un élément d'un plan. */
export function CheckButton({
  done,
  label,
  onClick,
}: {
  done: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={done}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "flex size-11 shrink-0 items-center justify-center rounded-full border-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        done
          ? "border-primary bg-primary text-primary-foreground"
          : "border-foreground/20 text-transparent hover:border-primary",
      )}
    >
      <Check aria-hidden="true" className="size-5" strokeWidth={3} />
    </button>
  );
}

/** Nutrition : « Remplacé par… » et ce qui a été mangé à la place. */
export function ReplaceMeal({
  target,
  log,
  controls,
  onSaved,
}: {
  target: LogTarget;
  log: PlanLogRow | null;
  controls: PlanLogControls;
  onSaved?: () => void;
}) {
  const t = useTranslations("Development.plan.runner");
  const id = useId();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(log?.replacedBy ?? "");
  const value = text.trim();

  // Coché « mangé » : rien à préciser (« Annuler » revient à ce choix)
  if (log && !log.replacedBy && !open) return null;
  if (log?.replacedBy && !open) {
    return (
      <button
        type="button"
        onClick={() => {
          setText(log.replacedBy ?? "");
          setOpen(true);
        }}
        className="min-h-11 w-full rounded-lg text-left text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {t("replaced", { food: log.replacedBy })}
      </button>
    );
  }
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-11 w-fit rounded-lg text-sm font-semibold text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {t("replace")}
      </button>
    );
  }
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (!value) return;
        controls.save(target, {
          done: true,
          replacedBy: value,
          outcome: null,
        });
        setOpen(false);
        onSaved?.();
      }}
    >
      <label htmlFor={id} className="text-sm font-semibold">
        {t("replaceLabel")}
      </label>
      <div className="flex gap-2">
        <Input
          id={id}
          autoFocus
          value={text}
          maxLength={PLAN_LOG_LIMITS.replacedBy}
          placeholder={t("replacePlaceholder")}
          onChange={(event) => setText(event.target.value)}
          className="h-11 min-w-0 flex-1"
        />
        <Button type="submit" className="h-11" disabled={!value}>
          {t("replaceSave")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="size-11"
          aria-label={t("cancel")}
          onClick={() => setOpen(false)}
        >
          <X aria-hidden="true" />
        </Button>
      </div>
    </form>
  );
}

/** Social : « comment ça s'est passé », en un toucher. */
export function ChallengeOutcome({
  target,
  log,
  controls,
  onChosen,
}: {
  target: LogTarget;
  log: PlanLogRow;
  controls: PlanLogControls;
  onChosen?: () => void;
}) {
  const t = useTranslations("Development.plan.runner");
  return (
    <div
      role="group"
      aria-label={t("outcomeTitle")}
      className="flex flex-col gap-2"
    >
      <span className="text-sm font-semibold">{t("outcomeTitle")}</span>
      <div className="grid grid-cols-3 gap-2">
        {OUTCOMES.map((outcome) => (
          <button
            key={outcome}
            type="button"
            aria-pressed={log.outcome === outcome}
            onClick={() => {
              controls.save(target, {
                done: true,
                replacedBy: null,
                outcome,
              });
              onChosen?.();
            }}
            className={cn(
              "min-h-11 rounded-xl px-2 text-sm font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              log.outcome === outcome
                ? "bg-primary text-primary-foreground"
                : "bg-foreground/[0.07] hover:bg-foreground/10",
            )}
          >
            {t(`outcomes.${outcome}`)}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Financier : le virement d'épargne fait s'ajoute au budget, sur un clic. */
export function SavingsToBudget({
  target,
  text,
  log,
  currency,
  controls,
}: {
  target: LogTarget;
  /** Le nom et le détail de l'action, où chercher le montant. */
  text: string;
  log: PlanLogRow;
  currency: string;
  controls: PlanLogControls;
}) {
  const t = useTranslations("Development.plan.runner.budget");
  const format = useFormatter();
  const locale = useLocale();
  const id = useId();
  const savings = savingsActionOf(text);
  const [amount, setAmount] = useState(
    savings?.cents ? amountField(savings.cents, locale) : "",
  );
  if (!savings) return null;

  if (log.budgetCents !== null) {
    return (
      <div className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <Wallet aria-hidden="true" className="size-4 text-primary" />
        <span className="font-semibold">
          {t("added", {
            amount: formatMoney(format, log.budgetCents, currency),
          })}
        </span>
        <Link
          href="/services/financial/budget"
          className="flex min-h-11 items-center rounded-lg font-semibold text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {t("see")}
        </Link>
        <button
          type="button"
          onClick={() => controls.removeFromBudget(target)}
          className="min-h-11 rounded-lg text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {t("remove")}
        </button>
      </div>
    );
  }
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (amount.trim()) controls.addToBudget(target, amount);
      }}
    >
      <label htmlFor={id} className="text-sm font-semibold">
        {t("title")}
      </label>
      <div className="flex gap-2">
        <Input
          id={id}
          inputMode="decimal"
          value={amount}
          placeholder={t("amount")}
          onChange={(event) => setAmount(event.target.value)}
          className="h-11 w-28 tabular-nums"
        />
        <Button
          type="submit"
          variant="outline"
          className="h-11 min-w-0 flex-1"
          disabled={!amount.trim() || controls.budgetPending}
        >
          {t("add")}
        </Button>
      </div>
    </form>
  );
}

/** Sous la carte d'un élément : ce qui reste à préciser, selon le plan. */
export function ItemFollowUp({
  target,
  text,
  log,
  currency,
  controls,
}: {
  target: LogTarget;
  text: string;
  log: PlanLogRow | null;
  currency: string;
  controls: PlanLogControls;
}) {
  const content =
    target.kind === "nutrition" && (!log || log.replacedBy) ? (
      <ReplaceMeal target={target} log={log} controls={controls} />
    ) : target.kind === "social" && log ? (
      <ChallengeOutcome target={target} log={log} controls={controls} />
    ) : target.kind === "financial" && log && savingsActionOf(text) ? (
      <SavingsToBudget
        target={target}
        text={text}
        log={log}
        currency={currency}
        controls={controls}
      />
    ) : null;
  return content ? (
    <div className="border-t border-foreground/8 px-3.5 py-1.5">{content}</div>
  ) : null;
}
