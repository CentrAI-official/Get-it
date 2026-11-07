"use client";

import { Download, LoaderCircle, Upload } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";
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
import { toDbDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import {
  exportEntriesAction,
  getImportHistoryAction,
  importEntriesAction,
} from "../budget-actions";
import { BUDGET_GROUPS } from "../categories";
import { amountField, formatMoney } from "../format";
import {
  DATE_ORDERS,
  guessCategory,
  guessMapping,
  MAX_IMPORT_ROWS,
  parseCsv,
  readImportRows,
  toCsv,
  type CsvMapping,
} from "../import";
import type { BudgetError } from "../rules";
import { useBudget, useCategoryName } from "./budget-context";

/** Un fichier de banque, en UTF-8 ou dans l'ancien encodage des banques québécoises. */
async function readText(file: File) {
  const utf8 = await file.text();
  if (!utf8.includes("�")) return utf8;
  return new TextDecoder("windows-1252").decode(await file.arrayBuffer());
}

/** Les colonnes numérotées, avec un exemple de ce qu'elles contiennent. */
function ColumnSelect({
  label,
  value,
  columns,
  optional,
  onChange,
  none,
}: {
  label: string;
  value: number | null;
  columns: readonly string[];
  optional?: boolean;
  onChange: (value: number | null) => void;
  none: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-semibold">
      {label}
      <select
        value={value ?? ""}
        onChange={(event) =>
          onChange(
            event.target.value === "" ? null : Number(event.target.value),
          )
        }
        className="h-11 w-full rounded-lg border border-input bg-transparent px-2 text-sm font-normal outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {optional ? <option value="">{none}</option> : null}
        {columns.map((column, index) => (
          <option key={index} value={index}>
            {column}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * Importer le relevé de sa banque. Le fichier reste dans le navigateur : on devine
 * ses colonnes, la personne vérifie, et seules les lignes retenues partent au serveur.
 */
export function ImportButton() {
  const t = useTranslations("Budget.import");
  const tErrors = useTranslations("Budget.errors");
  const format = useFormatter();
  const nameOf = useCategoryName();
  const { accounts, categories, currency } = useBudget();
  const input = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<string[][] | null>(null);
  const [mapping, setMapping] = useState<CsvMapping | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [history, setHistory] = useState<Record<string, string>>({});
  const [overrides, setOverrides] = useState<Record<number, string>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState<{ added: number; skipped: number } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();
  const open = rows !== null || done !== null;

  async function choose(file: File) {
    setProblem(null);
    setDone(null);
    setOverrides({});
    const parsed = parseCsv(await readText(file));
    if (parsed.length === 0) {
      setProblem(t("empty"));
      setRows([]);
      return;
    }
    setRows(parsed);
    setMapping(guessMapping(parsed));
    setHistory(await getImportHistoryAction().catch(() => ({})));
  }

  const read = rows && mapping ? readImportRows(rows, mapping) : null;
  const historyMap = new Map(Object.entries(history));
  const lines = (read?.rows ?? []).map((row, index) => ({
    row,
    category: overrides[index] ?? guessCategory(row.description, historyMap),
  }));
  const header = rows?.[0] ?? [];
  const columns = header.map((cell, index) =>
    t("column", {
      number: index + 1,
      sample: (mapping?.hasHeader ? cell : (rows?.[0]?.[index] ?? cell)).slice(
        0,
        24,
      ),
    }),
  );
  const change = (patch: Partial<CsvMapping>) =>
    setMapping((current) => (current ? { ...current, ...patch } : current));
  const tooMany = lines.length > MAX_IMPORT_ROWS;

  function close() {
    setRows(null);
    setMapping(null);
    setDone(null);
    setProblem(null);
    if (input.current) input.current.value = "";
  }

  function submit() {
    setProblem(null);
    startTransition(async () => {
      const result = await importEntriesAction({
        accountId,
        rows: lines.map(({ row, category }) => ({
          date: row.date,
          cents: row.cents,
          description: row.description,
          category,
        })),
      }).catch(() => ({ ok: false as const, error: "unexpected" as const }));
      if (result.ok) {
        setRows(null);
        setDone({ added: result.added, skipped: result.skipped });
      } else {
        setProblem(tErrors(result.error as BudgetError));
      }
    });
  }

  return (
    <>
      <input
        ref={input}
        type="file"
        accept=".csv,text/csv,text/plain"
        aria-label={t("choose")}
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void choose(file);
        }}
      />
      <Button
        variant="outline"
        className="h-11"
        onClick={() => input.current?.click()}
      >
        <Upload aria-hidden="true" />
        {t("button")}
      </Button>
      <Dialog open={open} onOpenChange={(value) => (value ? null : close())}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{done ? t("doneTitle") : t("title")}</DialogTitle>
            <DialogDescription>
              {done
                ? t("doneText", { added: done.added, skipped: done.skipped })
                : t("description")}
            </DialogDescription>
          </DialogHeader>
          {done ? (
            <DialogFooter>
              <Button className="h-11" onClick={close}>
                {t("close")}
              </Button>
            </DialogFooter>
          ) : mapping ? (
            <div className="flex flex-col gap-5">
              {accounts.length > 0 ? (
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-semibold">{t("account")}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {[null, ...accounts].map((account) => {
                      const id = account?.id ?? null;
                      return (
                        <button
                          key={id ?? "none"}
                          type="button"
                          aria-pressed={accountId === id}
                          onClick={() => setAccountId(id)}
                          className={cn(
                            "inline-flex min-h-10 items-center rounded-full border px-3 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                            accountId === id
                              ? "border-primary bg-primary/15"
                              : "border-foreground/10 text-muted-foreground",
                          )}
                        >
                          {account?.name ?? t("noAccount")}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
              <div className="grid grid-cols-2 gap-3">
                <ColumnSelect
                  label={t("date")}
                  value={mapping.date}
                  columns={columns}
                  none=""
                  onChange={(value) => change({ date: value ?? 0 })}
                />
                <ColumnSelect
                  label={t("descriptionColumn")}
                  value={mapping.description}
                  columns={columns}
                  none=""
                  onChange={(value) => change({ description: value ?? 0 })}
                />
                <ColumnSelect
                  label={t("amount")}
                  value={mapping.amount}
                  columns={columns}
                  optional
                  none={t("separate")}
                  onChange={(value) =>
                    change({
                      amount: value,
                      debit: value === null ? (mapping.debit ?? 0) : null,
                      credit: value === null ? (mapping.credit ?? 0) : null,
                    })
                  }
                />
                <label className="flex flex-col gap-1 text-sm font-semibold">
                  {t("dateOrder")}
                  <select
                    value={mapping.dateOrder}
                    onChange={(event) =>
                      change({
                        dateOrder: event.target
                          .value as CsvMapping["dateOrder"],
                      })
                    }
                    className="h-11 w-full rounded-lg border border-input bg-transparent px-2 text-sm font-normal outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {DATE_ORDERS.map((order) => (
                      <option key={order} value={order}>
                        {t(`orders.${order}`)}
                      </option>
                    ))}
                  </select>
                </label>
                {mapping.amount === null ? (
                  <>
                    <ColumnSelect
                      label={t("debit")}
                      value={mapping.debit}
                      columns={columns}
                      optional
                      none={t("noColumn")}
                      onChange={(value) => change({ debit: value })}
                    />
                    <ColumnSelect
                      label={t("credit")}
                      value={mapping.credit}
                      columns={columns}
                      optional
                      none={t("noColumn")}
                      onChange={(value) => change({ credit: value })}
                    />
                  </>
                ) : null}
              </div>
              <div className="flex flex-col gap-1">
                <label className="flex min-h-11 items-center gap-3 text-sm">
                  <Checkbox
                    checked={mapping.hasHeader}
                    onCheckedChange={(value) =>
                      change({ hasHeader: value === true })
                    }
                  />
                  {t("hasHeader")}
                </label>
                <label className="flex min-h-11 items-center gap-3 text-sm">
                  <Checkbox
                    checked={mapping.invert}
                    onCheckedChange={(value) =>
                      change({ invert: value === true })
                    }
                  />
                  {t("invert")}
                </label>
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="text-sm font-semibold">
                  {t("preview", { count: lines.length })}
                </h3>
                {read && read.skipped > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {t("skipped", { count: read.skipped })}
                  </p>
                ) : null}
                <ul className="flex flex-col">
                  {lines.slice(0, 8).map(({ row, category }, index) => (
                    <li
                      key={index}
                      className="flex flex-col gap-1 border-b border-foreground/8 py-2 last:border-b-0"
                    >
                      <span className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="min-w-0 truncate font-medium">
                          {row.description ?? t("noDescription")}
                        </span>
                        <span className="shrink-0 font-semibold tabular-nums">
                          {formatMoney(
                            format,
                            row.cents,
                            currency,
                            row.cents < 0 ? "expense" : "income",
                          )}
                        </span>
                      </span>
                      <span className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                        {format.dateTime(toDbDate(row.date), {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          timeZone: "UTC",
                        })}
                        {row.cents < 0 ? (
                          <select
                            aria-label={t("category", {
                              description: row.description ?? "",
                            })}
                            value={category}
                            onChange={(event) =>
                              setOverrides((current) => ({
                                ...current,
                                [index]: event.target.value,
                              }))
                            }
                            className="h-9 max-w-40 rounded-md border border-input bg-transparent px-1 text-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                          >
                            {BUDGET_GROUPS.flatMap((group) =>
                              categories
                                .filter((entry) => entry.group === group)
                                .map((entry) => (
                                  <option key={entry.key} value={entry.key}>
                                    {nameOf(entry.key)}
                                  </option>
                                )),
                            )}
                          </select>
                        ) : (
                          <span>{t("incomeRow")}</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
                {lines.length > 8 ? (
                  <p className="text-xs text-muted-foreground">
                    {t("more", { count: lines.length - 8 })}
                  </p>
                ) : null}
              </div>
              {tooMany ? (
                <p role="alert" className="text-sm text-destructive">
                  {t("tooMany", { max: MAX_IMPORT_ROWS })}
                </p>
              ) : null}
              {problem ? (
                <p role="alert" className="text-sm text-destructive">
                  {problem}
                </p>
              ) : null}
              <DialogFooter>
                <Button
                  className="h-11"
                  disabled={pending || lines.length === 0 || tooMany}
                  onClick={submit}
                >
                  {pending ? (
                    <LoaderCircle aria-hidden="true" className="animate-spin" />
                  ) : null}
                  {t("submit", { count: lines.length })}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <p role="alert" className="text-sm text-destructive">
              {problem}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/** « Exporter » : tout le budget, dans un fichier lisible par Excel. */
export function ExportButton() {
  const t = useTranslations("Budget.export");
  const tKinds = useTranslations("Budget.kinds");
  const locale = useLocale();
  const nameOf = useCategoryName();
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  function download() {
    setFailed(false);
    startTransition(async () => {
      try {
        const rows = await exportEntriesAction();
        const table = [
          [
            t("date"),
            t("type"),
            t("category"),
            t("description"),
            t("amount"),
            t("account"),
            t("toAccount"),
          ],
          ...rows.map((row) => [
            row.date,
            tKinds(row.kind),
            row.category ? nameOf(row.category) : "",
            row.note ?? "",
            `${
              row.kind === "expense" || row.amountCents < 0 ? "-" : ""
            }${amountField(row.amountCents, locale)}`,
            row.account ?? "",
            row.toAccount ?? "",
          ]),
        ];
        const url = URL.createObjectURL(
          new Blob([toCsv(table, locale)], { type: "text/csv;charset=utf-8" }),
        );
        const link = document.createElement("a");
        link.href = url;
        link.download = t("fileName");
        link.click();
        URL.revokeObjectURL(url);
      } catch {
        setFailed(true);
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        variant="outline"
        className="h-11"
        disabled={pending}
        onClick={download}
      >
        {pending ? (
          <LoaderCircle aria-hidden="true" className="animate-spin" />
        ) : (
          <Download aria-hidden="true" />
        )}
        {t("button")}
      </Button>
      {failed ? (
        <p role="alert" className="text-xs text-destructive">
          {t("failed")}
        </p>
      ) : null}
    </div>
  );
}
