"use client";

import { AlertTriangle, Check, LoaderCircle, Plus, Trash2 } from "lucide-react";
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
  applyPlanAction,
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
import { lineStatus, type MonthPlan, type PlanLine } from "../plan";
import type { BudgetError, BudgetRecurringRow } from "../rules";
import { useBudget, useCategoryName } from "./budget-context";
import { CategoryIcon } from "./category-icon";

function useMoney() {
  const format = useFormatter();
  const { currency } = useBudget();
  return (cents: number) => formatMoney(format, cents, currency);
}

/** La barre d'une catégorie : ce qui est sorti, ce qui s'en vient, et le temps écoulé du mois. */
function LineBar({
  line,
  elapsed,
  over,
}: {
  line: PlanLine;
  elapsed: number;
  over: boolean;
}) {
  const budget = Math.max(line.plannedCents + line.carryCents, 1);
  const spent = Math.min((Math.max(line.spentCents, 0) / budget) * 100, 100);
  const upcoming = Math.min((line.upcomingCents / budget) * 100, 100 - spent);
  return (
    <div aria-hidden="true" className="relative h-2">
      <div className="flex h-full gap-px overflow-hidden rounded-full bg-foreground/8">
        <span
          style={{ width: `${over ? 100 : spent}%` }}
          className="h-full bg-primary"
        />
        {!over && upcoming > 0 ? (
          <span
            style={{ width: `${upcoming}%` }}
            className="h-full budget-hatch"
          />
        ) : null}
      </div>
      {line.variable && elapsed > 0 && elapsed < 1 ? (
        // Où en est le mois : au-delà du trait, on dépense plus vite que le temps
        <span
          style={{ left: `${elapsed * 100}%` }}
          className="absolute -top-0.5 -bottom-0.5 w-0.5 -translate-x-1/2 rounded-full bg-foreground"
        />
      ) : null}
    </div>
  );
}

function PlanRow({
  line,
  elapsed,
  onOpen,
}: {
  line: PlanLine;
  elapsed: number;
  onOpen: () => void;
}) {
  const t = useTranslations("Budget.plan");
  const { categories } = useBudget();
  const nameOf = useCategoryName();
  const money = useMoney();
  const status = lineStatus(line, elapsed);
  const budget = line.plannedCents + line.carryCents;
  const savings = line.key === "savings";
  const over = status === "over";

  return (
    <li className="border-b border-foreground/8 last:border-b-0">
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center gap-3 py-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-foreground/6">
          <CategoryIcon
            category={line.key}
            categories={categories}
            className="size-[18px] text-muted-foreground"
          />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="flex items-baseline justify-between gap-3">
            <span className="truncate text-sm font-semibold">
              {nameOf(line.key)}
            </span>
            <span
              className={cn(
                "shrink-0 text-sm font-semibold tabular-nums",
                over && "text-primary",
              )}
            >
              {status === "unplanned"
                ? money(line.spentCents + line.upcomingCents)
                : over
                  ? t("over", { amount: money(-line.availableCents) })
                  : savings
                    ? money(line.spentCents)
                    : t("left", { amount: money(line.availableCents) })}
            </span>
          </span>
          {status === "unplanned" ? null : (
            <LineBar line={line} elapsed={elapsed} over={over} />
          )}
          <span className="flex items-baseline justify-between gap-3 text-xs text-muted-foreground">
            <span className="truncate">
              {status === "unplanned" ? (
                t("unplanned")
              ) : over ? (
                <span className="flex items-center gap-1 font-medium text-foreground">
                  <AlertTriangle aria-hidden="true" className="size-3.5" />
                  {t("overHint")}
                </span>
              ) : status === "fast" ? (
                <span className="font-medium text-foreground">{t("fast")}</span>
              ) : status === "reached" ? (
                <span className="flex items-center gap-1 font-medium text-primary">
                  <Check aria-hidden="true" className="size-3.5" />
                  {t("reached")}
                </span>
              ) : line.upcomingCents > 0 ? (
                t("upcoming", { amount: money(line.upcomingCents) })
              ) : line.carryCents !== 0 ? (
                t("carry", { amount: money(line.carryCents) })
              ) : null}
            </span>
            {status === "unplanned" ? null : (
              <span className="shrink-0 tabular-nums">
                {t(savings ? "ofSaved" : "of", { amount: money(budget) })}
              </span>
            )}
          </span>
        </span>
      </button>
    </li>
  );
}

function useErrorText() {
  const t = useTranslations("Budget.errors");
  return (key: BudgetError | null) => (key ? t(key) : null);
}

/** Une catégorie du plan : son montant, le report, et ses transactions. */
function LineDialog({
  line,
  month,
  onClose,
}: {
  line: PlanLine;
  month: string;
  onClose: () => void;
}) {
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
function AddLineDialog({
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

/** « À répartir » : les revenus qui n'ont pas encore de job, et la proposition 50/30/20. */
function ToAssign({
  plan,
  month,
  suggestion,
  onAdd,
}: {
  plan: MonthPlan;
  month: string;
  suggestion: { category: string; cents: number }[];
  onAdd: () => void;
}) {
  const t = useTranslations("Budget.plan");
  const money = useMoney();
  const nameOf = useCategoryName();
  const [proposing, setProposing] = useState(false);
  const [pending, startTransition] = useTransition();
  if (plan.expectedIncomeCents <= 0) return null;
  const left = plan.toAssignCents;

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-primary/[0.07] p-4">
      <div className="flex items-center gap-3">
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-sm font-semibold">
            {left > 0
              ? t("toAssign", { amount: money(left) })
              : left === 0
                ? t("assigned")
                : t("overAssigned", { amount: money(-left) })}
          </span>
          <span className="text-xs text-pretty text-muted-foreground">
            {left > 0
              ? t("toAssignHint")
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
        {left === 0 ? (
          <Check aria-hidden="true" className="size-5 shrink-0 text-primary" />
        ) : left > 0 ? (
          <Button size="sm" className="h-10 shrink-0" onClick={onAdd}>
            {t("assign")}
          </Button>
        ) : null}
      </div>
      {suggestion.length > 0 && left > 0 ? (
        proposing ? (
          <div className="flex flex-col gap-2 border-t border-foreground/8 pt-3">
            <p className="text-xs text-pretty text-muted-foreground">
              {t("suggestionHint")}
            </p>
            <ul className="flex flex-col gap-1 text-sm">
              {suggestion.map((item) => (
                <li
                  key={item.category}
                  className="flex items-baseline justify-between gap-3"
                >
                  <span>{nameOf(item.category)}</span>
                  <span className="font-semibold tabular-nums">
                    {money(item.cents)}
                  </span>
                </li>
              ))}
            </ul>
            <Button
              size="sm"
              className="mt-1 h-10 w-fit"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await applyPlanAction({ month, items: suggestion });
                })
              }
            >
              {pending ? (
                <LoaderCircle aria-hidden="true" className="animate-spin" />
              ) : null}
              {t("suggestionApply")}
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setProposing(true)}
            className="flex min-h-10 w-fit items-center text-sm font-semibold text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {t("suggestion")}
          </button>
        )
      ) : null}
    </div>
  );
}

/** Les dépenses annuelles : les préparer un peu chaque mois évite la grosse surprise. */
function AnnualToPrepare({
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

/** Le plan du mois : les trois groupes, ce qui reste dans chaque catégorie. */
export function PlanSection({
  plan,
  month,
  elapsed,
  suggestion,
  annual,
  goalsMonthlyCents,
}: {
  plan: MonthPlan;
  /** Le 1er jour du mois affiché. */
  month: string;
  elapsed: number;
  suggestion: { category: string; cents: number }[];
  annual: { rule: BudgetRecurringRow; monthlyCents: number }[];
  goalsMonthlyCents: number;
}) {
  const t = useTranslations("Budget.plan");
  const tGroups = useTranslations("Budget.groups");
  const money = useMoney();
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const lines = plan.groups.flatMap((group) => group.lines);
  const line = lines.find((entry) => entry.key === open) ?? null;

  return (
    <>
      <ToAssign
        plan={plan}
        month={month}
        suggestion={suggestion}
        onAdd={() => setAdding(true)}
      />
      {plan.groups.map((group) => (
        <section
          key={group.group}
          aria-label={tGroups(group.group)}
          className="flex flex-col gap-1 border-t border-foreground/8 pt-6"
        >
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="caps-label text-muted-foreground">
              {tGroups(group.group)}
            </h2>
            <span className="text-xs text-muted-foreground tabular-nums">
              {t("groupTotal", {
                used: money(group.usedCents),
                planned: money(group.plannedCents),
              })}
            </span>
          </div>
          <ul className="flex flex-col">
            {group.lines.map((entry) => (
              <PlanRow
                key={entry.key}
                line={entry}
                elapsed={elapsed}
                onOpen={() => setOpen(entry.key)}
              />
            ))}
          </ul>
          {group.group === "savings" && goalsMonthlyCents > 0 ? (
            <p className="pt-1 text-xs text-muted-foreground">
              {t("goalsNeed", { amount: money(goalsMonthlyCents) })}
            </p>
          ) : null}
        </section>
      ))}
      <Button
        variant="outline"
        className="h-11 w-full"
        onClick={() => setAdding(true)}
      >
        <Plus aria-hidden="true" />
        {t("addLine")}
      </Button>
      <AnnualToPrepare items={annual} month={month} />
      {line ? (
        <LineDialog
          key={line.key}
          line={line}
          month={month}
          onClose={() => setOpen(null)}
        />
      ) : null}
      {adding ? (
        <AddLineDialog
          month={month}
          hidden={lines.map((entry) => entry.key)}
          onClose={() => setAdding(false)}
        />
      ) : null}
    </>
  );
}
