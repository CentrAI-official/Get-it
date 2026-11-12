"use client";

import { Check, LoaderCircle, Plus, Sparkles } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
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
import { Link } from "@/i18n/navigation";
import { toDbDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { applyPlanAction } from "../budget-actions";
import { BUDGET_GROUPS, type BudgetGroup } from "../categories";
import { assignRows, unassignedCents } from "../envelopes";
import { amountField, displayMoney, formatMoney } from "../format";
import { suggestPlan, type MonthPlan } from "../plan";
import { parseAmount } from "../rules";
import { useBudget, useCategoryName } from "./budget-context";
import { CategoryIcon } from "./category-icon";
import { AddLineDialog } from "./envelope-dialogs";

// « Répartir » (décision du fondateur, 2026-11-12) : toutes les enveloppes d'un
// coup ; ce qui reste sans enveloppe baisse pendant qu'on tape, et tout
// s'enregistre ensemble.

/**
 * Où le plan d'argent envoie le surplus ce mois-ci (« de plus sur Visa »). Le
 * montant affiché est celui qui reste sans enveloppe : le plan d'argent compte
 * aussi l'enveloppe Épargne dans son surplus, et les deux chiffres ne doivent
 * pas se contredire.
 */
export type MoneyTarget = string | null;

function useMoney() {
  const format = useFormatter();
  const { currency } = useBudget();
  return (cents: number) => formatMoney(format, cents, currency);
}

/** Un montant tapé → cents : vide ou zéro vide l'enveloppe ; null s'il est invalide. */
function centsOf(value: string): number | null {
  const text = value.trim();
  if (text === "" || /^0+([.,]0{1,2})?$/.test(text)) return 0;
  return parseAmount(text);
}

/** « 645 $ sans enveloppe » (le chiffre en grand, orange s'il reste des dollars), « Chaque dollar a son enveloppe » ou « 120 $ de trop ». */
function LeftText({ cents, income }: { cents: number; income: number }) {
  const t = useTranslations("Budget.envelopes");
  const money = useMoney();
  if (income <= 0) return <>{t("noIncome")}</>;
  if (cents === 0) return <>{t("assigned")}</>;
  return (
    <>
      {t.rich(cents > 0 ? "unassigned" : "overAssigned", {
        amount: displayMoney(money(Math.abs(cents))),
        b: (chunks) => (
          <span
            className={cn(
              "font-display text-[1.375rem] font-normal tracking-wide whitespace-nowrap tabular-nums",
              cents > 0 && "text-primary",
            )}
          >
            {chunks}
          </span>
        ),
      })}
    </>
  );
}

/**
 * Le bandeau des enveloppes : les dollars qui n'ont pas encore de job, et
 * « Répartir ».
 */
export function AssignBanner({
  plan,
  month,
  elapsed,
  target,
  goalsMonthlyCents,
}: {
  plan: MonthPlan;
  month: string;
  elapsed: number;
  target: MoneyTarget;
  goalsMonthlyCents: number;
}) {
  const t = useTranslations("Budget.envelopes");
  const money = useMoney();
  const [open, setOpen] = useState(false);
  const left = plan.toAssignCents;
  const income = plan.expectedIncomeCents;

  return (
    <>
      <div className="flex items-center gap-3 rounded-2xl bg-primary/[0.08] py-3.5 pr-3.5 pl-4">
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[0.9375rem] font-bold text-pretty">
            <LeftText cents={left} income={income} />
          </span>
          <span className="text-[0.8125rem] text-pretty text-muted-foreground">
            {income <= 0
              ? t("noIncomeHint")
              : left > 0
                ? t("unassignedHint")
                : left === 0
                  ? t("assignedHint")
                  : t("overAssignedHint")}
          </span>
          {plan.minimumsReserveCents > 0 ? (
            <span className="text-xs text-pretty text-muted-foreground">
              {t("minimumsNote", {
                amount: money(plan.minimumsReserveCents),
              })}
            </span>
          ) : null}
        </span>
        {left === 0 && income > 0 ? (
          <Button
            variant="outline"
            className="h-11 shrink-0 rounded-full"
            onClick={() => setOpen(true)}
          >
            {t("edit")}
          </Button>
        ) : (
          <Button
            className="h-11 shrink-0 rounded-full px-4"
            onClick={() => setOpen(true)}
          >
            {t("assign")}
          </Button>
        )}
      </div>
      {open ? (
        <AssignSheet
          plan={plan}
          month={month}
          elapsed={elapsed}
          target={target}
          goalsMonthlyCents={goalsMonthlyCents}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function AssignSheet({
  plan,
  month,
  elapsed,
  target,
  goalsMonthlyCents,
  onClose,
}: {
  plan: MonthPlan;
  month: string;
  elapsed: number;
  target: MoneyTarget;
  goalsMonthlyCents: number;
  onClose: () => void;
}) {
  const t = useTranslations("Budget.envelopes.assignSheet");
  const tEnvelopes = useTranslations("Budget.envelopes");
  const tGroups = useTranslations("Budget.groups");
  const tPlan = useTranslations("Budget.plan");
  const format = useFormatter();
  const locale = useLocale();
  const id = useId();
  const money = useMoney();
  const nameOf = useCategoryName();
  const { categories } = useBudget();
  // Les enveloppes viennent du serveur : une enveloppe ajoutée apparaît toute seule
  const { rows, fixed } = assignRows(plan, elapsed);
  const spentOf = new Map(
    plan.groups.flatMap((group) =>
      group.lines.map((line) => [line.key, line.spentCents] as const),
    ),
  );
  // Ce qui a été tapé (enveloppe → texte), et les enveloppes ajoutées ici
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [added, setAdded] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  const original = new Map(rows.map((row) => [row.key, row.plannedCents]));
  const keys = [
    ...rows.map((row) => row.key),
    ...added.filter((key) => !original.has(key)),
  ];
  const valueOf = (key: string) =>
    edits[key] ??
    ((original.get(key) ?? 0) > 0
      ? amountField(original.get(key) ?? 0, locale)
      : "");
  const amounts = new Map(
    keys.map((key) => [key, centsOf(valueOf(key)) ?? original.get(key) ?? 0]),
  );
  const invalid = keys.filter((key) => centsOf(valueOf(key)) === null);
  const left = unassignedCents({
    incomeCents: plan.expectedIncomeCents,
    minimumsCents: plan.minimumsCents,
    fixed,
    amounts,
  });
  const fixedCents = fixed.reduce((sum, line) => sum + line.cents, 0);
  const groupOf = (key: string): BudgetGroup =>
    categories.find((entry) => entry.key === key)?.group ?? "wants";
  const monthLabel = format.dateTime(toDbDate(month), {
    month: "long",
    timeZone: "UTC",
  });

  /** 50/30/20, moins les paiements fixes de chaque groupe : un point de départ. */
  function propose() {
    const fixedByGroup = BUDGET_GROUPS.map((group) => ({
      group,
      cents: plan.groups
        .flatMap((entry) => entry.lines)
        .filter(
          (line) =>
            fixed.some((item) => item.key === line.key) && line.group === group,
        )
        .reduce((sum, line) => sum + line.plannedCents, 0),
    }));
    const items = suggestPlan(plan.expectedIncomeCents, [
      ...fixedByGroup,
      // Les minimums des dettes font partie des 20 % d'épargne et de dettes
      { group: "savings", cents: plan.minimumsReserveCents },
    ]);
    setEdits((current) => ({
      ...current,
      ...Object.fromEntries(
        items.map((item) => [item.category, amountField(item.cents, locale)]),
      ),
    }));
    setAdded((current) => [
      ...current,
      ...items
        .map((item) => item.category)
        .filter((key) => !current.includes(key)),
    ]);
  }

  function save() {
    setError(false);
    // Seulement ce qui a changé (une enveloppe ajoutée et laissée vide : rien)
    const items = keys
      .map((key) => ({ category: key, cents: amounts.get(key) ?? 0 }))
      .filter((item) => item.cents !== (original.get(item.category) ?? 0));
    if (items.length === 0) {
      onClose();
      return;
    }
    startTransition(async () => {
      const result = await applyPlanAction({ month, items }).catch(() => null);
      if (result?.ok) onClose();
      else setError(true);
    });
  }

  return (
    <Dialog
      open
      onOpenChange={(value) => (value || pending ? null : onClose())}
    >
      <DialogContent className="flex max-h-[100dvh] flex-col gap-0 overflow-hidden p-0 max-sm:h-[100dvh] max-sm:max-w-none max-sm:rounded-none max-sm:ring-0 sm:max-h-[90dvh] sm:max-w-lg">
        <DialogHeader className="gap-1 border-b border-foreground/8 px-4 pt-5 pb-3 text-left">
          <DialogTitle className="first-letter:uppercase">
            {t("title", { month: monthLabel })}
          </DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
          {/* Ce qui reste sans enveloppe, qui baisse pendant qu'on tape */}
          <p
            aria-live="polite"
            className="flex flex-wrap items-baseline gap-x-1.5 pt-2 text-[0.9375rem] font-bold"
          >
            {left === 0 && plan.expectedIncomeCents > 0 ? (
              <span className="flex items-center gap-1.5">
                <Check aria-hidden="true" className="size-4 text-primary" />
                {tEnvelopes("assigned")}
              </span>
            ) : (
              <LeftText cents={left} income={plan.expectedIncomeCents} />
            )}
          </p>
        </DialogHeader>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-4 py-4">
          {target && left > 0 ? (
            <div className="flex flex-col gap-1.5 rounded-2xl bg-foreground/[0.04] p-3.5">
              <span className="text-xs font-semibold text-muted-foreground">
                {t("moneyPlan")}
              </span>
              <p className="text-sm">
                <span className="font-semibold tabular-nums">
                  {money(left)}
                </span>{" "}
                {target}
              </p>
              <Link
                href="/services/financial/budget/goals"
                className="flex min-h-10 w-fit items-center text-sm font-semibold text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {t("moneyPlanLink")}
              </Link>
            </div>
          ) : null}

          {plan.expectedIncomeCents > 0 ? (
            <div className="flex flex-col gap-1">
              <Button
                type="button"
                variant="outline"
                className="h-11 w-fit"
                onClick={propose}
              >
                <Sparkles aria-hidden="true" />
                {t("suggestion")}
              </Button>
              <p className="text-xs text-pretty text-muted-foreground">
                {tPlan("suggestionHint")}
              </p>
            </div>
          ) : null}

          {BUDGET_GROUPS.map((group) => {
            const inGroup = keys.filter((key) => groupOf(key) === group);
            if (inGroup.length === 0) return null;
            return (
              <section
                key={group}
                aria-label={tGroups(group)}
                className="flex flex-col"
              >
                <h3 className="pb-1 caps-label text-muted-foreground">
                  {tGroups(group)}
                </h3>
                <ul className="flex flex-col">
                  {inGroup.map((key) => {
                    const bad = invalid.includes(key);
                    const spent = spentOf.get(key) ?? 0;
                    return (
                      <li
                        key={key}
                        className="flex items-center gap-3 border-b border-foreground/8 py-2 last:border-b-0"
                      >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-foreground/6">
                          <CategoryIcon
                            category={key}
                            categories={categories}
                            className="size-4 text-muted-foreground"
                          />
                        </span>
                        <label
                          htmlFor={`${id}-${key}`}
                          className="flex min-w-0 flex-1 flex-col"
                        >
                          <span className="truncate text-sm font-semibold">
                            {nameOf(key)}
                          </span>
                          {spent > 0 ? (
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {t("spentHint", { amount: money(spent) })}
                            </span>
                          ) : null}
                          {bad ? (
                            <span className="text-xs font-medium text-destructive">
                              {t("invalid")}
                            </span>
                          ) : null}
                        </label>
                        <div className="relative w-32 shrink-0">
                          <Input
                            id={`${id}-${key}`}
                            value={valueOf(key)}
                            onChange={(event) =>
                              setEdits((current) => ({
                                ...current,
                                [key]: event.target.value,
                              }))
                            }
                            inputMode="decimal"
                            autoComplete="off"
                            placeholder="0"
                            aria-invalid={bad ? true : undefined}
                            className="h-11 pr-7 text-right text-base font-semibold tabular-nums"
                          />
                          <span
                            aria-hidden="true"
                            className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-sm text-muted-foreground"
                          >
                            $
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                {group === "savings" && goalsMonthlyCents > 0 ? (
                  <p className="pt-1 text-xs text-muted-foreground">
                    {tPlan("goalsNeed", { amount: money(goalsMonthlyCents) })}
                  </p>
                ) : null}
              </section>
            );
          })}

          {fixedCents > 0 ? (
            <div className="flex items-center justify-between gap-3 border-t border-foreground/8 pt-4">
              <span className="flex min-w-0 flex-col">
                <span className="text-sm font-semibold">{t("fixedLine")}</span>
                <span className="text-xs text-pretty text-muted-foreground">
                  {t("fixedHint")}
                </span>
              </span>
              <span className="shrink-0 text-sm font-semibold tabular-nums">
                {money(fixedCents)}
              </span>
            </div>
          ) : null}

          <Button
            type="button"
            variant="outline"
            className="h-11 w-full"
            onClick={() => setAdding(true)}
          >
            <Plus aria-hidden="true" />
            {t("add")}
          </Button>
        </div>

        <DialogFooter className="flex-row justify-end gap-2 border-t border-foreground/8 px-4 py-3">
          {error ? (
            <p
              role="alert"
              className="mr-auto self-center text-sm text-destructive"
            >
              {t("error")}
            </p>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            className="h-11"
            disabled={pending}
            onClick={onClose}
          >
            {t("cancel")}
          </Button>
          <Button
            type="button"
            className="h-11"
            disabled={pending || invalid.length > 0}
            onClick={save}
          >
            {pending ? (
              <LoaderCircle aria-hidden="true" className="animate-spin" />
            ) : null}
            {t("save")}
          </Button>
        </DialogFooter>

        {adding ? (
          <AddLineDialog
            month={month}
            hidden={keys}
            onClose={() => setAdding(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
