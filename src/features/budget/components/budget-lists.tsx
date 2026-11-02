"use client";

import { LoaderCircle, Minus, Pencil, Plus, Trash2 } from "lucide-react";
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
import { formatMoney } from "../format";
import { CATEGORY_ICONS, INCOME_ICON } from "../icons";
import type { BudgetEntryRow, BudgetKind, BudgetRecurringRow } from "../rules";
import { EntryDialog, RecurringDialog } from "./budget-dialogs";

/** « Ajouter une dépense » et « Ajouter un revenu », en haut du budget. */
export function BudgetAddButtons({ today }: { today: string }) {
  const t = useTranslations("Budget");
  const [kind, setKind] = useState<BudgetKind | null>(null);
  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={() => setKind("expense")}>
        <Minus aria-hidden="true" />
        {t("addExpense")}
      </Button>
      <Button variant="outline" onClick={() => setKind("income")}>
        <Plus aria-hidden="true" />
        {t("addIncome")}
      </Button>
      {kind ? (
        <EntryDialog
          open
          onOpenChange={(open) => (open ? null : setKind(null))}
          entry={null}
          kind={kind}
          today={today}
        />
      ) : null}
    </div>
  );
}

/** Ajouter un revenu ou une dépense fixe (liste des fixes, premier passage). */
export function RecurringAddButton({
  kind,
  label,
  today,
  variant = "outline",
}: {
  kind: BudgetKind;
  label: string;
  today: string;
  variant?: "default" | "outline";
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} size="sm" onClick={() => setOpen(true)}>
        <Plus aria-hidden="true" />
        {label}
      </Button>
      {open ? (
        <RecurringDialog
          open
          onOpenChange={setOpen}
          item={null}
          kind={kind}
          today={today}
        />
      ) : null}
    </>
  );
}

function RowIcon({ row }: { row: { category: BudgetEntryRow["category"] } }) {
  const Icon = row.category ? CATEGORY_ICONS[row.category] : INCOME_ICON;
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-foreground/6">
      <Icon aria-hidden="true" className="size-[18px] text-muted-foreground" />
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
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations("Budget");
  return (
    <>
      <SwipeAction aria-label={t("editLabel", { title })} onClick={onEdit}>
        <Pencil aria-hidden="true" />
        {t("edit")}
      </SwipeAction>
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

/** Les mouvements de la période, rangés par jour (le plus récent d'abord). */
export function EntryList({
  entries,
  currency,
  today,
}: {
  entries: BudgetEntryRow[];
  currency: string;
  today: string;
}) {
  const t = useTranslations("Budget");
  const format = useFormatter();
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
  const titleOf = (entry: BudgetEntryRow) =>
    entry.note ??
    (entry.category ? t(`categories.${entry.category}`) : t("kinds.income"));

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
                const title = titleOf(entry);
                return (
                  <li
                    key={entry.id}
                    className="border-b border-foreground/8 last:border-b-0"
                  >
                    <SwipeRow
                      actions={
                        <RowActions
                          title={title}
                          onEdit={() => setEditing(entry)}
                          onDelete={() => remove(entry)}
                        />
                      }
                    >
                      <button
                        type="button"
                        onClick={() => setEditing(entry)}
                        className="flex w-full items-center gap-3 py-2.5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        <RowIcon row={entry} />
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-sm font-medium">
                            {title}
                          </span>
                          {entry.note ? (
                            <span className="truncate text-xs text-muted-foreground">
                              {entry.category
                                ? t(`categories.${entry.category}`)
                                : t("kinds.income")}
                            </span>
                          ) : null}
                        </span>
                        <span className="shrink-0 text-sm font-semibold tabular-nums">
                          {formatMoney(
                            format,
                            entry.amountCents,
                            currency,
                            entry.kind,
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
          kind={editing.kind}
          today={today}
        />
      ) : null}
    </div>
  );
}

/** Revenus et dépenses fixes, avec leur fréquence et leur prochaine date. */
export function RecurringList({
  items,
  currency,
  today,
}: {
  items: (BudgetRecurringRow & { next: string | null; monthlyCents: number })[];
  currency: string;
  today: string;
}) {
  const t = useTranslations("Budget");
  const format = useFormatter();
  const [editing, setEditing] = useState<BudgetRecurringRow | null>(null);
  const [confirming, setConfirming] = useState<BudgetRecurringRow | null>(null);
  const [removed, setRemoved] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const visible = items.filter((item) => !removed.includes(item.id));

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
                <RowIcon row={item} />
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
                      item.kind,
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
          today={today}
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
              variant="destructive"
              disabled={pending}
              onClick={() => {
                const item = confirming;
                if (!item) return;
                setRemoved((current) => [...current, item.id]);
                startTransition(async () => {
                  if (!(await deleteBudgetItemAction("recurring", item.id))) {
                    setRemoved((current) =>
                      current.filter((id) => id !== item.id),
                    );
                  }
                });
              }}
            >
              {t("delete")}
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
        <Button variant="ghost" size="sm" className="text-muted-foreground">
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
