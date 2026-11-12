"use client";

import { LoaderCircle, Minus, PiggyBank, Plus, Trash2 } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { cn } from "@/lib/utils";
import {
  createCategoryAction,
  deleteCategoryAction,
  prepareAnnualAction,
  setCategoryPlanAction,
  setRolloverAction,
} from "../budget-actions";
import {
  BUDGET_GROUPS,
  CATEGORY_NAME_MAX,
  CUSTOM_GROUPS,
  CUSTOM_ICONS,
  type CustomIcon,
} from "../categories";
import { amountField, formatMoney } from "../format";
import { CUSTOM_ICON_MAP } from "../icons";
import type { PlanLine } from "../plan";
import type { BudgetError, BudgetRecurringRow } from "../rules";
import { useBudget, useCategoryName } from "./budget-context";
import { CategoryIcon } from "./category-icon";

function useMoney() {
  const format = useFormatter();
  const { currency } = useBudget();
  return (cents: number) => formatMoney(format, cents, currency);
}

function useErrorText() {
  const t = useTranslations("Budget.errors");
  return (key: BudgetError | null) => (key ? t(key) : null);
}

/** Une enveloppe : son montant, le report, une dépense à ajouter et ses transactions. */
export function LineDialog({
  line,
  month,
  onClose,
  onSpend,
}: {
  line: PlanLine;
  month: string;
  onClose: () => void;
  /** Ajouter une dépense dans cette enveloppe (ou mettre de côté, pour l'épargne). */
  onSpend?: () => void;
}) {
  const tEnvelopes = useTranslations("Budget.envelopes");
  const t = useTranslations("Budget.plan");
  const locale = useLocale();
  const id = useId();
  const nameOf = useCategoryName();
  const money = useMoney();
  const errorText = useErrorText();
  const { categories } = useBudget();
  const custom = categories.find((entry) => entry.key === line.key)?.name;
  const [amount, setAmount] = useState(
    line.plannedCents > 0 ? amountField(line.plannedCents, locale) : "",
  );
  const [onlyThisMonth, setOnlyThisMonth] = useState(false);
  const [rollover, setRollover] = useState(line.rollover);
  const [error, setError] = useState<BudgetError | null>(null);
  const [pending, startTransition] = useTransition();

  function save(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await setCategoryPlanAction({
        category: line.key,
        month,
        amount,
        onlyThisMonth,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (rollover !== line.rollover) {
        await setRolloverAction({
          category: line.key,
          month,
          enabled: rollover,
        });
      }
      onClose();
    });
  }

  return (
    <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{nameOf(line.key)}</DialogTitle>
          <DialogDescription>{t("lineDescription")}</DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-3 gap-3 border-y border-foreground/8 py-3 text-sm">
          {(
            [
              ["spentLabel", line.spentCents],
              ["upcomingLabel", line.upcomingCents],
              ["availableLabel", line.availableCents],
            ] as const
          ).map(([key, cents]) => (
            <div key={key} className="flex flex-col gap-0.5">
              <dt className="text-xs text-muted-foreground">{t(key)}</dt>
              <dd className="font-semibold tabular-nums">{money(cents)}</dd>
            </div>
          ))}
        </dl>
        <form onSubmit={save} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor={`${id}-amount`} className="text-sm font-semibold">
              {t("amountLabel")}
            </label>
            <div className="relative">
              <Input
                id={`${id}-amount`}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                inputMode="decimal"
                autoComplete="off"
                placeholder="0"
                aria-invalid={error ? true : undefined}
                className="h-12 pr-9 font-display text-2xl tracking-wide tabular-nums"
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-lg text-muted-foreground"
              >
                $
              </span>
            </div>
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {errorText(error)}
              </p>
            ) : null}
          </div>
          <label className="flex min-h-11 items-start gap-3 text-sm">
            <Checkbox
              checked={onlyThisMonth}
              onCheckedChange={(value) => setOnlyThisMonth(value === true)}
              className="mt-0.5"
            />
            <span className="flex flex-col">
              <span className="font-medium">{t("onlyThisMonth")}</span>
              <span className="text-xs text-muted-foreground">
                {t("onlyThisMonthHint")}
              </span>
            </span>
          </label>
          <label className="flex min-h-11 items-start gap-3 text-sm">
            <Checkbox
              checked={rollover}
              onCheckedChange={(value) => setRollover(value === true)}
              className="mt-0.5"
            />
            <span className="flex flex-col">
              <span className="font-medium">{t("rollover")}</span>
              <span className="text-xs text-muted-foreground">
                {t("rolloverHint")}
              </span>
            </span>
          </label>
          {onSpend ? (
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full"
              onClick={onSpend}
            >
              {line.key === "savings" ? (
                <PiggyBank aria-hidden="true" />
              ) : (
                <Minus aria-hidden="true" />
              )}
              {tEnvelopes(line.key === "savings" ? "putAside" : "spend")}
            </Button>
          ) : null}
          <Link
            href={{
              pathname: "/services/financial/budget/transactions",
              query: { cat: line.key, month: month.slice(0, 7) },
            }}
            className="flex min-h-11 w-fit items-center text-sm font-semibold text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {t("seeTransactions")}
          </Link>
          <DialogFooter>
            {custom ? (
              <Button
                type="button"
                variant="ghost"
                className="text-muted-foreground sm:mr-auto"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await deleteCategoryAction(line.key);
                    if (result.ok) onClose();
                  })
                }
              >
                <Trash2 aria-hidden="true" />
                {t("deleteCategory")}
              </Button>
            ) : null}
            <Button type="submit" disabled={pending}>
              {pending ? (
                <LoaderCircle aria-hidden="true" className="animate-spin" />
              ) : null}
              {t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Ajouter une catégorie au plan : une de Get iT, ou une à soi. */
export function AddLineDialog({
  month,
  hidden,
  onClose,
}: {
  month: string;
  /** Les catégories déjà dans le plan. */
  hidden: readonly string[];
  onClose: () => void;
}) {
  const t = useTranslations("Budget.plan");
  const tGroups = useTranslations("Budget.groups");
  const tIcons = useTranslations("Budget.customIcons");
  const id = useId();
  const nameOf = useCategoryName();
  const errorText = useErrorText();
  const { categories } = useBudget();
  const [chosen, setChosen] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [group, setGroup] = useState<(typeof CUSTOM_GROUPS)[number]>("wants");
  const [icon, setIcon] = useState<CustomIcon>("tag");
  const [error, setError] = useState<BudgetError | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      if (creating) {
        const created = await createCategoryAction({ name, group, icon });
        if (!created.ok) setError(created.error);
        else setCreating(false);
        return;
      }
      if (!chosen) {
        setError("categoryRequired");
        return;
      }
      const result = await setCategoryPlanAction({
        category: chosen,
        month,
        amount,
        onlyThisMonth: false,
      });
      if (result.ok) onClose();
      else setError(result.error);
    });
  }

  return (
    <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {creating ? t("newCategoryTitle") : t("addTitle")}
          </DialogTitle>
          <DialogDescription>
            {creating ? t("newCategoryDescription") : t("addDescription")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-5">
          {creating ? (
            <>
              <div className="flex flex-col gap-2">
                <label htmlFor={`${id}-name`} className="text-sm font-semibold">
                  {t("categoryName")}
                </label>
                <Input
                  id={`${id}-name`}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={CATEGORY_NAME_MAX}
                  autoComplete="off"
                  className="h-11"
                />
              </div>
              <div
                role="radiogroup"
                aria-label={t("categoryGroup")}
                className="flex flex-wrap gap-2"
              >
                {CUSTOM_GROUPS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={group === value}
                    onClick={() => setGroup(value)}
                    className={cn(
                      "h-11 rounded-full border px-4 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      group === value
                        ? "border-primary bg-primary/15"
                        : "border-foreground/10 text-muted-foreground",
                    )}
                  >
                    {tGroups(value)}
                  </button>
                ))}
              </div>
              <div
                role="radiogroup"
                aria-label={t("categoryIcon")}
                className="grid grid-cols-6 gap-2"
              >
                {CUSTOM_ICONS.map((value) => {
                  const Icon = CUSTOM_ICON_MAP[value];
                  return (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={icon === value}
                      aria-label={tIcons(value)}
                      onClick={() => setIcon(value)}
                      className={cn(
                        "flex size-11 items-center justify-center rounded-xl border outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                        icon === value
                          ? "border-primary bg-primary/15"
                          : "border-foreground/10 text-muted-foreground",
                      )}
                    >
                      <Icon aria-hidden="true" className="size-5" />
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              {BUDGET_GROUPS.map((value) => {
                const inGroup = categories.filter(
                  (entry) =>
                    entry.group === value && !hidden.includes(entry.key),
                );
                if (inGroup.length === 0) return null;
                return (
                  <div key={value} className="flex flex-col gap-2">
                    <span className="caps-label text-muted-foreground">
                      {tGroups(value)}
                    </span>
                    <div
                      role="radiogroup"
                      aria-label={tGroups(value)}
                      className="flex flex-wrap gap-2"
                    >
                      {inGroup.map((entry) => (
                        <button
                          key={entry.key}
                          type="button"
                          role="radio"
                          aria-checked={chosen === entry.key}
                          onClick={() => setChosen(entry.key)}
                          className={cn(
                            "inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                            chosen === entry.key
                              ? "border-primary bg-primary/15"
                              : "border-foreground/10 text-muted-foreground hover:text-foreground",
                          )}
                        >
                          <CategoryIcon
                            category={entry.key}
                            categories={categories}
                            className="size-4"
                          />
                          {nameOf(entry.key)}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="flex min-h-11 w-fit items-center gap-1.5 text-sm font-semibold text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <Plus aria-hidden="true" className="size-4" />
                {t("newCategory")}
              </button>
              <div className="flex flex-col gap-2">
                <label
                  htmlFor={`${id}-amount`}
                  className="text-sm font-semibold"
                >
                  {t("amountLabel")}
                </label>
                <Input
                  id={`${id}-amount`}
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0"
                  className="h-12 font-display text-2xl tracking-wide tabular-nums"
                />
              </div>
            </>
          )}
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {errorText(error)}
            </p>
          ) : null}
          <DialogFooter>
            {creating ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setCreating(false)}
              >
                {t("back")}
              </Button>
            ) : null}
            <Button type="submit" disabled={pending}>
              {pending ? (
                <LoaderCircle aria-hidden="true" className="animate-spin" />
              ) : null}
              {creating ? t("createCategory") : t("add")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Les dépenses annuelles : les préparer un peu chaque mois évite la grosse surprise. */
export function AnnualToPrepare({
  items,
  month,
}: {
  items: { rule: BudgetRecurringRow; monthlyCents: number }[];
  month: string;
}) {
  const t = useTranslations("Budget.plan");
  const money = useMoney();
  const [pending, startTransition] = useTransition();
  if (items.length === 0) return null;
  return (
    <section
      aria-labelledby="budget-annual"
      className="flex flex-col gap-2 border-t border-foreground/8 pt-6"
    >
      <h2 id="budget-annual" className="caps-label text-muted-foreground">
        {t("annualTitle")}
      </h2>
      <p className="text-xs text-pretty text-muted-foreground">
        {t("annualHint")}
      </p>
      <ul className="flex flex-col">
        {items.map(({ rule, monthlyCents }) => (
          <li
            key={rule.id}
            className="flex items-center justify-between gap-3 border-b border-foreground/8 py-2.5 last:border-b-0"
          >
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-semibold">
                {rule.label}
              </span>
              <span className="text-xs text-muted-foreground">
                {t("annualAmount", { amount: money(rule.amountCents) })}
              </span>
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-10 shrink-0"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await prepareAnnualAction({
                    category: rule.category,
                    month,
                    amountCents: monthlyCents,
                  });
                })
              }
            >
              {t("annualPrepare", { amount: money(monthlyCents) })}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
