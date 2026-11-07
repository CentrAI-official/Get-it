"use client";

import { LoaderCircle, Plus, Trash2 } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import {
  createElement,
  useActionState,
  useId,
  useState,
  useTransition,
} from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  ACCOUNT_NAME_MAX,
  ACCOUNT_TYPES,
  isDebtType,
  type AccountField,
  type AccountType,
  type BudgetAccountRow,
} from "../accounts";
import {
  adjustBalanceAction,
  deleteAccountAction,
  saveAccountAction,
  type FormResult,
} from "../budget-actions";
import { amountField, formatMoney } from "../format";
import { ACCOUNT_ICONS } from "../icons";
import type { BudgetError } from "../rules";
import { AmountField } from "./budget-dialogs";
import { useBudget } from "./budget-context";

/** Ajouter un compte. */
export function AccountAddButton({
  variant = "outline",
}: {
  variant?: "default" | "outline";
}) {
  const t = useTranslations("Budget.accounts");
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant={variant}
        className="h-11 w-full sm:w-fit"
        onClick={() => setOpen(true)}
      >
        <Plus aria-hidden="true" />
        {t("add")}
      </Button>
      {open ? (
        <AccountDialog account={null} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}

/** Une ligne de compte : son solde, et ce qu'on peut y faire. */
export function AccountRow({
  line,
  debt,
}: {
  line: BudgetAccountRow & { balanceCents: number };
  debt: boolean;
}) {
  const t = useTranslations("Budget.accounts");
  const format = useFormatter();
  const { currency } = useBudget();
  const [open, setOpen] = useState(false);
  return (
    <li className="border-b border-foreground/8 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 py-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-foreground/6">
          {createElement(ACCOUNT_ICONS[line.type], {
            "aria-hidden": true,
            className: "size-[18px] text-muted-foreground",
          })}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-semibold">{line.name}</span>
          {debt && line.rateBp !== null ? (
            <span className="text-xs text-muted-foreground">
              {t("rateShort", { rate: line.rateBp / 100 })}
            </span>
          ) : null}
        </span>
        <span className="shrink-0 text-sm font-semibold tabular-nums">
          {formatMoney(format, line.balanceCents, currency)}
        </span>
      </button>
      {open ? (
        <AccountDialog account={line} onClose={() => setOpen(false)} />
      ) : null}
    </li>
  );
}

function useErrorText() {
  const t = useTranslations("Budget.errors");
  return (key: BudgetError | undefined | null) => (key ? t(key) : null);
}

/** Ajouter ou modifier un compte, et mettre son solde à jour. */
function AccountDialog({
  account,
  onClose,
}: {
  account: (BudgetAccountRow & { balanceCents: number }) | null;
  onClose: () => void;
}) {
  const t = useTranslations("Budget.accounts");
  const tForm = useTranslations("Budget.form");
  const locale = useLocale();
  const id = useId();
  const errorText = useErrorText();
  const { today } = useBudget();
  const [type, setType] = useState<AccountType>(account?.type ?? "chequing");
  const [name, setName] = useState(account?.name ?? "");
  const [balance, setBalance] = useState(
    account ? signedField(account.openingCents, account.type, locale) : "",
  );
  const [date, setDate] = useState(account?.openedOn ?? today);
  const [rate, setRate] = useState(
    account?.rateBp !== null && account?.rateBp !== undefined
      ? amountField(account.rateBp, locale)
      : "",
  );
  const [minimum, setMinimum] = useState(
    account?.minimumCents ? amountField(account.minimumCents, locale) : "",
  );
  const [current, setCurrent] = useState(
    account ? signedField(account.balanceCents, account.type, locale) : "",
  );
  const [adjustError, setAdjustError] = useState<BudgetError | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, startTransition] = useTransition();
  const [state, formAction, pending] = useActionState<
    FormResult<AccountField>,
    FormData
  >(
    async (previous, formData) => {
      const result = await saveAccountAction(
        account?.id ?? null,
        previous,
        formData,
      );
      if (result.status === "saved") onClose();
      return result;
    },
    { status: "idle" },
  );
  const debt = isDebtType(type);
  const fieldError = (field: AccountField) =>
    errorText(state.fieldErrors?.[field]);

  return (
    <>
      <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{account ? account.name : t("add")}</DialogTitle>
            <DialogDescription>{t("formText")}</DialogDescription>
          </DialogHeader>

          {account ? (
            <form
              className="flex flex-col gap-3 border-b border-foreground/8 pb-5"
              onSubmit={(event) => {
                event.preventDefault();
                setAdjustError(null);
                startTransition(async () => {
                  const result = await adjustBalanceAction({
                    accountId: account.id,
                    balance: current,
                  });
                  if (result.ok) onClose();
                  else setAdjustError(result.error);
                });
              }}
            >
              <AmountField
                id={`${id}-current`}
                name="current"
                label={t(debt ? "currentDebt" : "currentBalance")}
                value={current}
                onChange={setCurrent}
                error={errorText(adjustError)}
              />
              <p className="text-xs text-pretty text-muted-foreground">
                {t("adjustHint")}
              </p>
              <Button
                type="submit"
                variant="outline"
                className="h-11 w-fit"
                disabled={busy}
              >
                {t("adjust")}
              </Button>
            </form>
          ) : null}

          <form action={formAction} noValidate className="flex flex-col gap-5">
            <fieldset className="flex flex-col gap-1.5">
              <legend className="pb-1.5 text-sm font-semibold">
                {t("type")}
              </legend>
              <input type="hidden" name="type" value={type} />
              <div className="flex flex-wrap gap-1.5">
                {ACCOUNT_TYPES.map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={type === value}
                    onClick={() => setType(value)}
                    className={cn(
                      "inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      type === value
                        ? "border-primary bg-primary/15"
                        : "border-foreground/10 text-muted-foreground",
                    )}
                  >
                    {createElement(ACCOUNT_ICONS[value], {
                      "aria-hidden": true,
                      className: "size-4",
                    })}
                    {t(`types.${value}`)}
                  </button>
                ))}
              </div>
            </fieldset>
            <Field data-invalid={fieldError("name") ? true : undefined}>
              <FieldLabel htmlFor={`${id}-name`}>{t("name")}</FieldLabel>
              <Input
                id={`${id}-name`}
                name="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={ACCOUNT_NAME_MAX}
                autoComplete="off"
                placeholder={t(`namePlaceholder.${type}`)}
                className="h-11"
              />
              {fieldError("name") ? (
                <FieldError>{fieldError("name")}</FieldError>
              ) : null}
            </Field>
            <AmountField
              id={id}
              name="balance"
              label={t(debt ? "owedAt" : "balanceAt")}
              value={balance}
              onChange={setBalance}
              error={fieldError("balance")}
            />
            <Field data-invalid={fieldError("date") ? true : undefined}>
              <FieldLabel htmlFor={`${id}-date`}>{tForm("date")}</FieldLabel>
              <Input
                id={`${id}-date`}
                name="date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="h-11 w-auto"
              />
              <FieldDescription>{t("dateHint")}</FieldDescription>
            </Field>
            {debt ? (
              <div className="grid grid-cols-2 gap-3">
                <Field data-invalid={fieldError("rate") ? true : undefined}>
                  <FieldLabel htmlFor={`${id}-rate`}>{t("rate")}</FieldLabel>
                  <Input
                    id={`${id}-rate`}
                    name="rate"
                    value={rate}
                    onChange={(event) => setRate(event.target.value)}
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="19,99"
                    className="h-11"
                  />
                  {fieldError("rate") ? (
                    <FieldError>{fieldError("rate")}</FieldError>
                  ) : null}
                </Field>
                <Field data-invalid={fieldError("minimum") ? true : undefined}>
                  <FieldLabel htmlFor={`${id}-minimum`}>
                    {t("minimum")}
                  </FieldLabel>
                  <Input
                    id={`${id}-minimum`}
                    name="minimum"
                    value={minimum}
                    onChange={(event) => setMinimum(event.target.value)}
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="50"
                    className="h-11"
                  />
                  {fieldError("minimum") ? (
                    <FieldError>{fieldError("minimum")}</FieldError>
                  ) : null}
                </Field>
              </div>
            ) : null}
            {state.error ? (
              <p role="alert" className="text-sm text-destructive">
                {errorText(state.error)}
              </p>
            ) : null}
            <DialogFooter>
              {account ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-muted-foreground sm:mr-auto"
                  onClick={() => setConfirming(true)}
                >
                  <Trash2 aria-hidden="true" />
                  {t("delete")}
                </Button>
              ) : null}
              <Button type="submit" className="h-11" disabled={pending}>
                {pending ? (
                  <LoaderCircle aria-hidden="true" className="animate-spin" />
                ) : null}
                {account ? t("save") : t("add")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("deleteTitle", { name: account?.name ?? "" })}
            </AlertDialogTitle>
            <AlertDialogDescription>{t("deleteText")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() =>
                startTransition(async () => {
                  if (account) {
                    const result = await deleteAccountAction(account.id);
                    if (result.ok) onClose();
                  }
                })
              }
            >
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** Un solde dans un champ : une dette s'écrit en positif, un compte peut être négatif. */
function signedField(cents: number, type: AccountType, locale: string) {
  const text = amountField(cents, locale);
  return cents < 0 && !isDebtType(type) ? `-${text}` : text;
}
