"use client";

import { Search, SlidersHorizontal } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useId, useState } from "react";
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
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { BUDGET_GROUPS } from "../categories";
import { monthsUntil } from "../reports";
import type { EntryKind } from "../rules";
import { useBudget, useCategoryName } from "./budget-context";

const TRANSACTIONS_PATH = "/services/financial/budget/transactions";
const TYPES: readonly EntryKind[] = ["expense", "income", "refund", "transfer"];
/** Mois proposés dans les filtres. */
const MONTHS = 13;

const chip =
  "inline-flex min-h-10 items-center rounded-full border px-3 text-sm font-medium outline-none first-letter:uppercase focus-visible:ring-3 focus-visible:ring-ring/50";
const chipOn = "border-primary bg-primary/15 text-foreground";
const chipOff =
  "border-foreground/10 text-muted-foreground hover:text-foreground";

function Choices<Value extends string>({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string;
  options: readonly { value: Value; label: string }[];
  value: Value | null;
  onChange: (value: Value | null) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="pb-1.5 text-sm font-semibold">{legend}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() =>
              onChange(value === option.value ? null : option.value)
            }
            className={cn(chip, value === option.value ? chipOn : chipOff)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/** La recherche et les filtres de la liste, gardés dans l'adresse. */
export function TransactionFilterBar({
  query,
  category,
  type,
  account,
  month,
}: {
  query: string;
  category: string | null;
  type: EntryKind | null;
  account: string | null;
  month: string | null;
}) {
  const t = useTranslations("Budget");
  const format = useFormatter();
  const router = useRouter();
  const id = useId();
  const nameOf = useCategoryName();
  const { categories, accounts, today } = useBudget();
  const [text, setText] = useState(query);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ category, type, account, month });

  function go(next: {
    q: string;
    cat: string | null;
    type: string | null;
    account: string | null;
    month: string | null;
  }) {
    router.push(
      {
        pathname: TRANSACTIONS_PATH,
        query: Object.fromEntries(
          Object.entries(next).filter((entry): entry is [string, string] =>
            Boolean(entry[1]),
          ),
        ),
      },
      { scroll: false },
    );
  }
  const active = [category, type, account, month].filter(Boolean).length;

  return (
    <div className="flex items-center gap-2">
      <form
        role="search"
        className="relative min-w-0 flex-1"
        onSubmit={(event) => {
          event.preventDefault();
          go({ q: text.trim(), cat: category, type, account, month });
        }}
      >
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          id={`${id}-search`}
          type="search"
          aria-label={t("transactions.search")}
          placeholder={t("transactions.search")}
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={80}
          className="h-11 pl-9"
        />
      </form>
      <Button
        variant="outline"
        className="h-11 shrink-0"
        onClick={() => {
          setDraft({ category, type, account, month });
          setOpen(true);
        }}
      >
        <SlidersHorizontal aria-hidden="true" />
        {active > 0
          ? t("transactions.filtersCount", { count: active })
          : t("transactions.filters")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("transactions.filters")}</DialogTitle>
            <DialogDescription>
              {t("transactions.filtersText")}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-5">
            <Choices
              legend={t("transactions.month")}
              options={monthsUntil(today.slice(0, 7), MONTHS)
                .reverse()
                .map((value) => ({
                  value,
                  label: format.dateTime(new Date(`${value}-01T00:00:00Z`), {
                    month: "short",
                    year: "2-digit",
                    timeZone: "UTC",
                  }),
                }))}
              value={draft.month}
              onChange={(value) =>
                setDraft((current) => ({ ...current, month: value }))
              }
            />
            <Choices
              legend={t("transactions.type")}
              options={TYPES.map((value) => ({
                value,
                label: t(`kinds.${value}`),
              }))}
              value={draft.type}
              onChange={(value) =>
                setDraft((current) => ({ ...current, type: value }))
              }
            />
            {accounts.length > 0 ? (
              <Choices
                legend={t("form.account")}
                options={accounts.map((entry) => ({
                  value: entry.id,
                  label: entry.name,
                }))}
                value={draft.account}
                onChange={(value) =>
                  setDraft((current) => ({ ...current, account: value }))
                }
              />
            ) : null}
            {BUDGET_GROUPS.map((group) => (
              <Choices
                key={group}
                legend={t(`groups.${group}`)}
                options={categories
                  .filter((entry) => entry.group === group)
                  .map((entry) => ({
                    value: entry.key,
                    label: nameOf(entry.key),
                  }))}
                value={draft.category}
                onChange={(value) =>
                  setDraft((current) => ({ ...current, category: value }))
                }
              />
            ))}
          </div>
          <DialogFooter>
            <Button
              className="h-11"
              onClick={() => {
                setOpen(false);
                go({
                  q: text.trim(),
                  cat: draft.category,
                  type: draft.type,
                  account: draft.account,
                  month: draft.month,
                });
              }}
            >
              {t("transactions.apply")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
