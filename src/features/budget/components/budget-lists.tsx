"use client";

import {
  ArrowLeftRight,
  LoaderCircle,
  Minus,
  Pencil,
  Plus,
  Repeat,
  Trash2,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { SwipeAction, SwipeRow } from "@/components/swipe-row";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { addDays, toDbDate } from "@/lib/dates";
import { deleteBudgetItemAction, eraseBudgetAction } from "../actions";
import { entrySign, formatMoney } from "../format";
import { ADJUSTMENT_ICON, INCOME_ICON, TRANSFER_ICON } from "../icons";
import type { BudgetEntryRow, BudgetKind, BudgetRecurringRow } from "../rules";
import { EntryDialog, RecurringDialog } from "./budget-dialogs";
import { useBudget, useCategoryName } from "./budget-context";
import { CategoryIcon } from "./category-icon";

/** « Dépense », « Revenu » et « Virement », en haut du budget. */
export function BudgetActions() {
  const t = useTranslations("Budget");
  const { accounts } = useBudget();
  const [kind, setKind] = useState<BudgetKind | null>(null);
  return (
    <div className="grid grid-cols-[1.4fr_1fr] gap-2 sm:flex sm:flex-wrap">
      <Button className="h-12 text-base" onClick={() => setKind("expense")}>
        <Minus aria-hidden="true" />
        {t("addExpense")}
      </Button>
      <Button
        variant="outline"
        className="h-12 text-base"
        onClick={() => setKind("income")}
      >
        <Plus aria-hidden="true" />
        {t("addIncome")}
      </Button>
      {accounts.length >= 2 ? (
        <Button
          variant="outline"
          className="col-span-2 h-11"
          onClick={() => setKind("transfer")}
        >
          <ArrowLeftRight aria-hidden="true" />
          {t("addTransfer")}
        </Button>
      ) : null}
      {kind ? (
        <EntryDialog
          open
          onOpenChange={(open) => (open ? null : setKind(null))}
          entry={null}
          kind={kind}
        />
      ) : null}
    </div>
  );
}

/** Ajouter un montant fixe. */
export function RecurringAddButton({
  kind,
  label,
  variant = "outline",
}: {
  kind: BudgetKind;
  label: string;
  variant?: "default" | "outline";
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} className="h-11" onClick={() => setOpen(true)}>
        <Plus aria-hidden="true" />
        {label}
      </Button>
      {open ? (
        <RecurringDialog open onOpenChange={setOpen} item={null} kind={kind} />
      ) : null}
    </>
  );
}

function RowIcon({
  kind,
  category,
}: {
  kind: BudgetEntryRow["kind"];
  category: string | null;
}) {
  const { categories } = useBudget();
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-foreground/6">
      {kind === "income" ? (
        <INCOME_ICON
          aria-hidden="true"
          className="size-[18px] text-muted-foreground"
        />
      ) : kind === "transfer" ? (
        <TRANSFER_ICON
          aria-hidden="true"
          className="size-[18px] text-muted-foreground"
        />
      ) : kind === "adjustment" ? (
        <ADJUSTMENT_ICON
          aria-hidden="true"
          className="size-[18px] text-muted-foreground"
        />
      ) : (
        <CategoryIcon
          category={category}
          categories={categories}
          className="size-[18px] text-muted-foreground"
        />
      )}
    </span>
  );
}

/** Actions révélées en glissant la ligne : « Modifier » et « Supprimer ». */
function RowActions({
  title,
  onEdit,
  onDelete,
}: {
  title: string;
  onEdit: (() => void) | null;
  onDelete: () => void;
}) {
  const t = useTranslations("Budget");
  return (
    <>
      {onEdit ? (
        <SwipeAction aria-label={t("editLabel", { title })} onClick={onEdit}>
          <Pencil aria-hidden="true" />
          {t("edit")}
        </SwipeAction>
      ) : null}
      <SwipeAction
        tone="danger"
        aria-label={t("deleteLabel", { title })}
        onClick={onDelete}
      >
        <Trash2 aria-hidden="true" />
        {t("delete")}
      </SwipeAction>
    </>
  );
}

/** Le nom et le sous-titre d'une transaction, selon son type. */
function useEntryText() {
  const t = useTranslations("Budget");
  const nameOf = useCategoryName();
  const { accounts } = useBudget();
  const accountName = (id: string | null) =>
    accounts.find((account) => account.id === id)?.name ?? t("noAccount");
  return (entry: BudgetEntryRow) => {
    const base =
      entry.kind === "income"
        ? t("kinds.income")
        : entry.kind === "transfer"
          ? t("kinds.transfer")
          : entry.kind === "adjustment"
            ? t("kinds.adjustment")
            : nameOf(entry.category);
    const detail =
      entry.kind === "transfer"
        ? t("transferRoute", {
            from: accountName(entry.accountId),
            to: accountName(entry.toAccountId),
          })
        : entry.kind === "refund"
          ? t("refundOf", { category: base })
          : entry.note
            ? base
            : null;
    return { title: entry.note ?? base, detail };
  };
}

/** Des transactions, rangées par jour (le plus récent d'abord). */
export function EntryList({ entries }: { entries: BudgetEntryRow[] }) {
  const t = useTranslations("Budget");
  const format = useFormatter();
  const { today, currency } = useBudget();
  const textOf = useEntryText();
  const [editing, setEditing] = useState<BudgetEntryRow | null>(null);
  const [removed, setRemoved] = useState<string[]>([]);
  const [, startTransition] = useTransition();
  const visible = entries.filter((entry) => !removed.includes(entry.id));

  const days = [...new Set(visible.map((entry) => entry.occurredOn))];
  const dayLabel = (day: string) =>
    day === today
      ? t("today")
      : day === addDays(today, -1)
        ? t("yesterday")
        : format.dateTime(toDbDate(day), {
            weekday: "long",
            day: "numeric",
            month: "long",
            timeZone: "UTC",
          });

  function remove(entry: BudgetEntryRow) {
    setRemoved((current) => [...current, entry.id]);
    startTransition(async () => {
      if (!(await deleteBudgetItemAction("entry", entry.id))) {
        setRemoved((current) => current.filter((id) => id !== entry.id));
      }
    });
  }

  if (visible.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("noEntries")}</p>;
  }
  return (
    <div className="flex flex-col gap-4">
      {days.map((day) => (
        <section key={day} className="flex flex-col">
          <h3 className="pb-1 text-xs font-medium text-muted-foreground first-letter:uppercase">
            {dayLabel(day)}
          </h3>
          <ul className="flex flex-col">
            {visible
              .filter((entry) => entry.occurredOn === day)
              .map((entry) => {
                const { title, detail } = textOf(entry);
                const editable = entry.kind !== "adjustment";
                return (
                  <li
                    key={entry.id}
                    className="border-b border-foreground/8 last:border-b-0"
                  >
                    <SwipeRow
                      actions={
                        <RowActions
                          title={title}
                          onEdit={editable ? () => setEditing(entry) : null}
                          onDelete={() => remove(entry)}
                        />
                      }
                    >
                      <button
                        type="button"
                        disabled={!editable}
                        onClick={() => setEditing(entry)}
                        className="flex w-full items-center gap-3 py-2.5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        <RowIcon kind={entry.kind} category={entry.category} />
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="flex items-center gap-1.5 text-sm font-medium">
                            <span className="truncate">{title}</span>
                            {entry.recurringId ? (
                              <Repeat
                                role="img"
                                aria-label={t("automatic")}
                                className="size-3 shrink-0 text-muted-foreground"
                              />
                            ) : null}
                          </span>
                          {detail ? (
                            <span className="truncate text-xs text-muted-foreground">
                              {detail}
                            </span>
                          ) : null}
                        </span>
                        <span className="shrink-0 text-sm font-semibold tabular-nums">
                          {formatMoney(
                            format,
                            entry.amountCents,
                            currency,
                            entrySign(
                              entry.kind,
                              entry.amountCents,
                              entry.category,
                            ),
                          )}
                        </span>
                      </button>
                    </SwipeRow>
                  </li>
                );
              })}
          </ul>
        </section>
      ))}
      {editing ? (
        <EntryDialog
          open
          onOpenChange={(open) => (open ? null : setEditing(null))}
          entry={editing}
          kind={
            editing.kind === "income"
              ? "income"
              : editing.kind === "transfer"
                ? "transfer"
                : "expense"
          }
        />
      ) : null}
    </div>
  );
}

/** Les montants fixes, avec leur fréquence et leur prochaine date. */
export function RecurringList({
  items,
}: {
  items: (BudgetRecurringRow & { next: string | null; monthlyCents: number })[];
}) {
  const t = useTranslations("Budget");
  const format = useFormatter();
  const { currency } = useBudget();
  const [editing, setEditing] = useState<BudgetRecurringRow | null>(null);
  const [confirming, setConfirming] = useState<BudgetRecurringRow | null>(null);
  const [removed, setRemoved] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const visible = items.filter((item) => !removed.includes(item.id));

  function remove(item: BudgetRecurringRow, withHistory: boolean) {
    setRemoved((current) => [...current, item.id]);
    setConfirming(null);
    startTransition(async () => {
      if (!(await deleteBudgetItemAction("recurring", item.id, withHistory))) {
        setRemoved((current) => current.filter((id) => id !== item.id));
      }
    });
  }

  if (visible.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("noFixed")}</p>;
  }
  return (
    <>
      <ul className="flex flex-col">
        {visible.map((item) => (
          <li
            key={item.id}
            className="border-b border-foreground/8 last:border-b-0"
          >
            <SwipeRow
              actions={
                <RowActions
                  title={item.label}
                  onEdit={() => setEditing(item)}
                  onDelete={() => setConfirming(item)}
                />
              }
            >
              <button
                type="button"
                onClick={() => setEditing(item)}
                className="flex w-full items-center gap-3 py-2.5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <RowIcon kind={item.kind} category={item.category} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">
                    {item.label}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {t(`every.${item.frequency}`, {
                      amount: formatMoney(format, item.amountCents, currency),
                    })}
                    {item.next
                      ? ` · ${t("next", {
                          date: format.dateTime(toDbDate(item.next), {
                            day: "numeric",
                            month: "short",
                            timeZone: "UTC",
                          }),
                        })}`
                      : ` · ${t("ended")}`}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end">
                  <span className="text-sm font-semibold tabular-nums">
                    {formatMoney(
                      format,
                      item.monthlyCents,
                      currency,
                      item.kind === "transfer" ? undefined : item.kind,
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t("perMonth")}
                  </span>
                </span>
              </button>
            </SwipeRow>
          </li>
        ))}
      </ul>
      {editing ? (
        <RecurringDialog
          open
          onOpenChange={(open) => (open ? null : setEditing(null))}
          item={editing}
          kind={editing.kind}
        />
      ) : null}
      <AlertDialog
        open={confirming !== null}
        onOpenChange={(open) => (open ? null : setConfirming(null))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("deleteFixedTitle", { title: confirming?.label ?? "" })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteFixedDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="outline"
              disabled={pending}
              onClick={() => {
                if (confirming) remove(confirming, true);
              }}
            >
              {t("deleteFixedAll")}
            </AlertDialogAction>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={() => {
                if (confirming) remove(confirming, false);
              }}
            >
              {t("deleteFixedKeep")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** « Effacer mon budget » : tout, après confirmation. */
export function EraseBudgetButton() {
  const t = useTranslations("Budget.erase");
  const [pending, startTransition] = useTransition();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" className="h-11 text-muted-foreground">
          {pending ? (
            <LoaderCircle aria-hidden="true" className="animate-spin" />
          ) : (
            <Trash2 aria-hidden="true" />
          )}
          {t("button")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("title")}</AlertDialogTitle>
          <AlertDialogDescription>{t("description")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() =>
              startTransition(async () => {
                await eraseBudgetAction();
              })
            }
          >
            {t("confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
