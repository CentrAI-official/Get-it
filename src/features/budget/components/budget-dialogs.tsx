"use client";

import { LoaderCircle, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useActionState, useId, useState, useTransition } from "react";
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
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  deleteBudgetItemAction,
  saveEntryAction,
  saveRecurringAction,
  type BudgetFormState,
} from "../actions";
import { isDebtType, type BudgetAccountRow } from "../accounts";
import { BUDGET_GROUPS } from "../categories";
import { amountField } from "../format";
import {
  BUDGET_FREQUENCIES,
  BUDGET_KINDS,
  BUDGET_LABEL_MAX,
  BUDGET_NOTE_MAX,
  type BudgetEntryRow,
  type BudgetError,
  type BudgetFrequency,
  type BudgetKind,
  type BudgetRecurringRow,
  type EntryField,
  type RecurringField,
} from "../rules";
import { useBudget, useCategoryName } from "./budget-context";
import { CategoryIcon } from "./category-icon";

const chip =
  "inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50";
const chipOn = "border-primary bg-primary/15 text-foreground";
const chipOff =
  "border-foreground/10 text-muted-foreground hover:text-foreground";

/** Un choix parmi des pastilles, gardé dans un champ caché. */
export function Chips<Value extends string>({
  name,
  legend,
  values,
  value,
  onChange,
  label,
  error,
}: {
  name: string;
  legend: string;
  values: readonly Value[];
  value: Value | null;
  onChange: (value: Value) => void;
  label: (value: Value) => string;
  error?: string | null;
}) {
  return (
    <FieldSet data-invalid={error ? true : undefined}>
      <FieldLegend variant="label">{legend}</FieldLegend>
      <input type="hidden" name={name} value={value ?? ""} />
      <div
        role="radiogroup"
        aria-label={legend}
        className="flex flex-wrap gap-2"
      >
        {values.map((entry) => (
          <button
            key={entry}
            type="button"
            role="radio"
            aria-checked={value === entry}
            onClick={() => onChange(entry)}
            className={cn(chip, value === entry ? chipOn : chipOff)}
          >
            {label(entry)}
          </button>
        ))}
      </div>
      {error ? <FieldError>{error}</FieldError> : null}
    </FieldSet>
  );
}

/** Les catégories, rangées par groupe (essentiels, envies, épargne et dettes). */
function CategoryField({
  value,
  onChange,
  error,
}: {
  value: string | null;
  onChange: (value: string) => void;
  error: string | null;
}) {
  const t = useTranslations("Budget.form");
  const tGroups = useTranslations("Budget.groups");
  const nameOf = useCategoryName();
  const { categories } = useBudget();
  return (
    <FieldSet data-invalid={error ? true : undefined}>
      <FieldLegend variant="label">{t("category")}</FieldLegend>
      <input type="hidden" name="category" value={value ?? ""} />
      <div className="flex flex-col gap-3">
        {BUDGET_GROUPS.map((group) => (
          <div key={group} className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">
              {tGroups(group)}
            </span>
            <div
              role="radiogroup"
              aria-label={tGroups(group)}
              className="flex flex-wrap gap-1.5"
            >
              {categories
                .filter((entry) => entry.group === group)
                .map((entry) => (
                  <button
                    key={entry.key}
                    type="button"
                    role="radio"
                    aria-checked={value === entry.key}
                    onClick={() => onChange(entry.key)}
                    className={cn(chip, value === entry.key ? chipOn : chipOff)}
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
        ))}
      </div>
      {error ? <FieldError>{error}</FieldError> : null}
    </FieldSet>
  );
}

/**
 * Un compte parmi ceux de la personne ; `optional` permet de n'en choisir aucun,
 * `only` garde certains comptes (ceux d'où part un paiement).
 */
export function AccountField({
  name,
  legend,
  value,
  onChange,
  optional,
  exclude,
  only,
  error,
}: {
  name: string;
  legend: string;
  value: string | null;
  onChange: (value: string | null) => void;
  optional: boolean;
  exclude?: string | null;
  only?: (account: BudgetAccountRow) => boolean;
  error?: string | null;
}) {
  const t = useTranslations("Budget");
  const { accounts } = useBudget();
  return (
    <FieldSet data-invalid={error ? true : undefined}>
      <FieldLegend variant="label">{legend}</FieldLegend>
      <input type="hidden" name={name} value={value ?? ""} />
      <div
        role="radiogroup"
        aria-label={legend}
        className="flex flex-wrap gap-2"
      >
        {optional ? (
          <button
            type="button"
            role="radio"
            aria-checked={value === null}
            onClick={() => onChange(null)}
            className={cn(chip, value === null ? chipOn : chipOff)}
          >
            {t("noAccount")}
          </button>
        ) : null}
        {accounts
          .filter(
            (account) => account.id !== exclude && (only?.(account) ?? true),
          )
          .map((account) => (
            <button
              key={account.id}
              type="button"
              role="radio"
              aria-checked={value === account.id}
              onClick={() => onChange(account.id)}
              className={cn(chip, value === account.id ? chipOn : chipOff)}
            >
              {account.name}
            </button>
          ))}
      </div>
      {error ? <FieldError>{error}</FieldError> : null}
    </FieldSet>
  );
}

/** Champ du montant, en grand, avec le symbole de la devise. */
export function AmountField({
  id,
  value,
  onChange,
  error,
  label,
  name = "amount",
  autoFocus,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  error: string | null;
  label?: string;
  name?: string;
  autoFocus?: boolean;
}) {
  const t = useTranslations("Budget.form");
  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={`${id}-${name}`}>{label ?? t("amount")}</FieldLabel>
      <div className="relative">
        <Input
          id={`${id}-${name}`}
          name={name}
          value={value}
          onChange={(change) => onChange(change.target.value)}
          inputMode="decimal"
          autoComplete="off"
          autoFocus={autoFocus}
          placeholder={t("amountPlaceholder")}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-${name}-error` : undefined}
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
        <FieldError id={`${id}-${name}-error`}>{error}</FieldError>
      ) : null}
    </Field>
  );
}

/** « Supprimer » dans une fenêtre de modification. */
function DeleteButton({
  type,
  itemId,
  onDeleted,
}: {
  type: "entry" | "recurring";
  itemId: string;
  onDeleted: () => void;
}) {
  const t = useTranslations("Budget.form");
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="ghost"
      className="text-muted-foreground sm:mr-auto"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          if (await deleteBudgetItemAction(type, itemId)) onDeleted();
        })
      }
    >
      {pending ? (
        <LoaderCircle aria-hidden="true" className="animate-spin" />
      ) : (
        <Trash2 aria-hidden="true" />
      )}
      {t("delete")}
    </Button>
  );
}

function useErrorText() {
  const t = useTranslations("Budget.errors");
  return (key: BudgetError | undefined) => (key ? t(key) : null);
}

/** Un virement demande deux comptes : sans eux, ce choix n'est pas proposé. */
function useKinds() {
  const { accounts } = useBudget();
  return accounts.length >= 2
    ? BUDGET_KINDS
    : BUDGET_KINDS.filter((kind) => kind !== "transfer");
}

/** Ajouter ou modifier une transaction. */
export function EntryDialog({
  open,
  onOpenChange,
  entry,
  kind,
  category,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** La transaction à modifier, ou null pour en ajouter une. */
  entry: BudgetEntryRow | null;
  /** Type proposé pour une nouvelle transaction. */
  kind: BudgetKind;
  /**
   * Dépense rapide (une enveloppe touchée) : la catégorie est choisie, il ne
   * reste qu'à taper le montant.
   */
  category?: string;
}) {
  const t = useTranslations("Budget.form");
  const tQuick = useTranslations("Budget.envelopes.quick");
  const nameOf = useCategoryName();
  const quick = entry === null && category !== undefined;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {quick
              ? nameOf(category)
              : entry
                ? t(`editTitle.${kind}`)
                : t(`addTitle.${kind}`)}
          </DialogTitle>
          <DialogDescription>
            {quick ? tQuick("description") : t("entryDescription")}
          </DialogDescription>
        </DialogHeader>
        <EntryForm
          entry={entry}
          kind={kind}
          category={category}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function EntryForm({
  entry,
  kind: initialKind,
  category: initialCategory,
  onDone,
}: {
  entry: BudgetEntryRow | null;
  kind: BudgetKind;
  category?: string;
  onDone: () => void;
}) {
  const t = useTranslations("Budget");
  const locale = useLocale();
  const id = useId();
  const errorText = useErrorText();
  const kinds = useKinds();
  const { accounts, goals, today } = useBudget();
  const [kind, setKind] = useState<BudgetKind>(initialKind);
  const [refund, setRefund] = useState(entry?.kind === "refund");
  const [amount, setAmount] = useState(
    entry ? amountField(entry.amountCents, locale) : "",
  );
  const [category, setCategory] = useState<string | null>(
    entry?.category ?? initialCategory ?? null,
  );
  // Dépense rapide : le montant et la note ; le reste sous « Plus d'options »
  const [quick, setQuick] = useState(
    entry === null && initialCategory !== undefined,
  );
  const [date, setDate] = useState(entry?.occurredOn ?? today);
  const [note, setNote] = useState(entry?.note ?? "");
  const [accountId, setAccountId] = useState<string | null>(
    entry?.accountId ?? null,
  );
  const [toAccountId, setToAccountId] = useState<string | null>(
    entry?.toAccountId ?? null,
  );
  const [goalId, setGoalId] = useState<string | null>(entry?.goalId ?? null);
  // Ajout seulement : la transaction revient selon une fréquence
  const [repeat, setRepeat] = useState<BudgetFrequency | "never">("never");
  // Une dépense « Dettes » peut payer une dette précise : c'est alors un virement
  const [debtId, setDebtId] = useState<string | null>(null);
  const nameOf = useCategoryName();
  const debts = accounts.filter((account) => isDebtType(account.type));
  const canPayDebt =
    kind === "expense" &&
    !refund &&
    category === "debt" &&
    debts.length > 0 &&
    accounts.some((account) => !isDebtType(account.type));
  const payingDebt = canPayDebt && debtId !== null;
  const [state, formAction, pending] = useActionState<
    BudgetFormState<EntryField>,
    FormData
  >(
    async (previous, formData) => {
      const result = await saveEntryAction(
        entry?.id ?? null,
        previous,
        formData,
      );
      if (result.status === "saved") onDone();
      return result;
    },
    { status: "idle" },
  );
  const fieldError = (field: EntryField) =>
    errorText(state.fieldErrors?.[field]);
  const savingGoal =
    kind === "expense" && category === "savings" && goals.length > 0;
  const canRepeat = entry === null && !refund && !(savingGoal && goalId);
  // Le nom du montant fixe : la note, sinon la dette, la catégorie ou le type
  const repeatLabel =
    note.trim() ||
    (payingDebt
      ? (debts.find((debt) => debt.id === debtId)?.name ?? "")
      : kind === "expense" && category
        ? nameOf(category)
        : t(`kinds.${kind}`));

  const noteField = (
    <Field data-invalid={fieldError("note") ? true : undefined}>
      <FieldLabel htmlFor={`${id}-note`}>
        {t("form.note")}{" "}
        <span className="font-normal text-muted-foreground">
          {t("form.optional")}
        </span>
      </FieldLabel>
      <Input
        id={`${id}-note`}
        name="note"
        value={note}
        onChange={(change) => setNote(change.target.value)}
        maxLength={BUDGET_NOTE_MAX}
        autoComplete="off"
        placeholder={t(`form.notePlaceholder.${kind}`)}
        className="h-11"
      />
      {fieldError("note") ? (
        <FieldError>{fieldError("note")}</FieldError>
      ) : null}
    </Field>
  );

  if (quick) {
    // Les champs cachés ont leur erreur ici : la dépense rapide ne les montre pas
    const hiddenError =
      fieldError("category") ?? fieldError("date") ?? fieldError("accountId");
    return (
      <form action={formAction} noValidate className="flex flex-col gap-5">
        <FieldGroup className="gap-5">
          <input type="hidden" name="kind" value="expense" />
          <input type="hidden" name="category" value={category ?? ""} />
          <input type="hidden" name="date" value={date} />
          <input type="hidden" name="accountId" value={accountId ?? ""} />
          <AmountField
            id={id}
            value={amount}
            onChange={setAmount}
            error={fieldError("amount")}
            autoFocus
          />
          {noteField}
          <button
            type="button"
            onClick={() => setQuick(false)}
            className="flex min-h-11 w-fit items-center text-sm font-semibold text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {t("envelopes.quick.more")}
          </button>
        </FieldGroup>
        {state.error || hiddenError ? (
          <p role="alert" className="text-sm text-destructive">
            {state.error ? errorText(state.error) : hiddenError}
          </p>
        ) : null}
        <DialogFooter>
          <Button type="submit" className="h-11" disabled={pending}>
            {pending ? (
              <LoaderCircle aria-hidden="true" className="animate-spin" />
            ) : null}
            {t("form.add")}
          </Button>
        </DialogFooter>
      </form>
    );
  }

  return (
    <form action={formAction} noValidate className="flex flex-col gap-5">
      <FieldGroup className="gap-5">
        <Chips
          name="kindChoice"
          legend={t("form.kind")}
          values={kinds}
          value={kind}
          onChange={setKind}
          label={(value) => t(`kinds.${value}`)}
        />
        {/* Ce qui part au serveur : un remboursement est une dépense à l'envers */}
        <input
          type="hidden"
          name="kind"
          value={
            payingDebt
              ? "transfer"
              : kind === "expense" && refund
                ? "refund"
                : kind
          }
        />
        <AmountField
          id={id}
          value={amount}
          onChange={setAmount}
          error={fieldError("amount")}
        />
        {kind === "expense" ? (
          <>
            <CategoryField
              value={category}
              onChange={setCategory}
              error={fieldError("category")}
            />
            <label className="flex min-h-11 items-start gap-3 text-sm">
              <Checkbox
                checked={refund}
                // Au clic seulement : React remet le formulaire à zéro après un
                // envoi refusé, et la case ne doit pas se décocher
                onClick={() => setRefund((value) => !value)}
                className="mt-0.5"
              />
              <span className="flex flex-col">
                <span className="font-medium">{t("form.refund")}</span>
                <span className="text-xs text-muted-foreground">
                  {t("form.refundHint")}
                </span>
              </span>
            </label>
            {canPayDebt ? (
              <FieldSet>
                <FieldLegend variant="label">{t("form.whichDebt")}</FieldLegend>
                <div
                  role="radiogroup"
                  aria-label={t("form.whichDebt")}
                  className="flex flex-wrap gap-2"
                >
                  {debts.map((debt) => (
                    <button
                      key={debt.id}
                      type="button"
                      role="radio"
                      aria-checked={debtId === debt.id}
                      onClick={() => {
                        setDebtId(debt.id);
                        // Le paiement part d'un compte de tous les jours
                        const from = accounts.find(
                          (account) => account.id === accountId,
                        );
                        if (from && isDebtType(from.type)) setAccountId(null);
                      }}
                      className={cn(
                        chip,
                        debtId === debt.id ? chipOn : chipOff,
                      )}
                    >
                      {debt.name}
                    </button>
                  ))}
                  <button
                    type="button"
                    role="radio"
                    aria-checked={debtId === null}
                    onClick={() => setDebtId(null)}
                    className={cn(chip, debtId === null ? chipOn : chipOff)}
                  >
                    {t("form.otherDebt")}
                  </button>
                </div>
                {payingDebt ? (
                  <FieldDescription>{t("form.debtHint")}</FieldDescription>
                ) : null}
              </FieldSet>
            ) : null}
          </>
        ) : null}
        {savingGoal ? (
          <FieldSet>
            <FieldLegend variant="label">{t("form.goal")}</FieldLegend>
            <input type="hidden" name="goalId" value={goalId ?? ""} />
            <div
              role="radiogroup"
              aria-label={t("form.goal")}
              className="flex flex-wrap gap-2"
            >
              <button
                type="button"
                role="radio"
                aria-checked={goalId === null}
                onClick={() => setGoalId(null)}
                className={cn(chip, goalId === null ? chipOn : chipOff)}
              >
                {t("form.noGoal")}
              </button>
              {goals.map((goal) => (
                <button
                  key={goal.id}
                  type="button"
                  role="radio"
                  aria-checked={goalId === goal.id}
                  onClick={() => setGoalId(goal.id)}
                  className={cn(chip, goalId === goal.id ? chipOn : chipOff)}
                >
                  {goal.name}
                </button>
              ))}
            </div>
          </FieldSet>
        ) : null}
        {payingDebt ? (
          <>
            <input type="hidden" name="toAccountId" value={debtId ?? ""} />
            <AccountField
              name="accountId"
              legend={t("form.paidFrom")}
              value={accountId}
              onChange={setAccountId}
              optional={false}
              only={(account) => !isDebtType(account.type)}
              error={fieldError("accountId")}
            />
          </>
        ) : kind === "transfer" ? (
          <>
            <AccountField
              name="accountId"
              legend={t("form.from")}
              value={accountId}
              onChange={setAccountId}
              optional={false}
              error={fieldError("accountId")}
            />
            <AccountField
              name="toAccountId"
              legend={t("form.to")}
              value={toAccountId}
              onChange={setToAccountId}
              optional={false}
              exclude={accountId}
              error={fieldError("toAccountId")}
            />
            <FieldDescription>{t("form.transferHint")}</FieldDescription>
          </>
        ) : accounts.length > 0 ? (
          <AccountField
            name="accountId"
            legend={t("form.account")}
            value={accountId}
            onChange={setAccountId}
            optional
          />
        ) : null}
        <Field data-invalid={fieldError("date") ? true : undefined}>
          <FieldLabel htmlFor={`${id}-date`}>{t("form.date")}</FieldLabel>
          <Input
            id={`${id}-date`}
            name="date"
            type="date"
            value={date}
            onChange={(change) => setDate(change.target.value)}
            aria-invalid={fieldError("date") ? true : undefined}
            className="h-11 w-auto"
          />
          {fieldError("date") ? (
            <FieldError>{fieldError("date")}</FieldError>
          ) : null}
        </Field>
        {noteField}
        {canRepeat ? (
          <div className="flex flex-col gap-2">
            <Chips
              name="repeat"
              legend={t("form.repeat")}
              values={["never", ...BUDGET_FREQUENCIES] as const}
              value={repeat}
              onChange={setRepeat}
              label={(value) =>
                value === "never"
                  ? t("form.repeatNever")
                  : t(`frequencies.${value}`)
              }
            />
            <input type="hidden" name="label" value={repeatLabel} />
            {repeat !== "never" ? (
              <FieldDescription>{t("form.repeatHint")}</FieldDescription>
            ) : null}
          </div>
        ) : null}
      </FieldGroup>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {errorText(state.error)}
        </p>
      ) : null}
      <DialogFooter>
        {entry ? (
          <DeleteButton type="entry" itemId={entry.id} onDeleted={onDone} />
        ) : null}
        <Button type="submit" className="h-11" disabled={pending}>
          {pending ? (
            <LoaderCircle aria-hidden="true" className="animate-spin" />
          ) : null}
          {entry ? t("form.save") : t("form.add")}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Ajouter ou modifier un montant fixe. */
export function RecurringDialog({
  open,
  onOpenChange,
  item,
  kind,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: BudgetRecurringRow | null;
  kind: BudgetKind;
}) {
  const t = useTranslations("Budget.form");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {item ? t(`editFixedTitle.${kind}`) : t(`addFixedTitle.${kind}`)}
          </DialogTitle>
          <DialogDescription>{t("fixedDescription")}</DialogDescription>
        </DialogHeader>
        <RecurringForm
          item={item}
          kind={kind}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function RecurringForm({
  item,
  kind: initialKind,
  onDone,
}: {
  item: BudgetRecurringRow | null;
  kind: BudgetKind;
  onDone: () => void;
}) {
  const t = useTranslations("Budget");
  const locale = useLocale();
  const id = useId();
  const errorText = useErrorText();
  const kinds = useKinds();
  const { accounts, today } = useBudget();
  const [kind, setKind] = useState<BudgetKind>(initialKind);
  const [label, setLabel] = useState(item?.label ?? "");
  const [amount, setAmount] = useState(
    item ? amountField(item.amountCents, locale) : "",
  );
  const [frequency, setFrequency] = useState<BudgetFrequency>(
    item?.frequency ?? "monthly",
  );
  const [category, setCategory] = useState<string | null>(
    item?.category ?? null,
  );
  const [startsOn, setStartsOn] = useState(item?.startsOn ?? today);
  const [endsOn, setEndsOn] = useState(item?.endsOn ?? "");
  const [accountId, setAccountId] = useState<string | null>(
    item?.accountId ?? null,
  );
  const [toAccountId, setToAccountId] = useState<string | null>(
    item?.toAccountId ?? null,
  );
  const [state, formAction, pending] = useActionState<
    BudgetFormState<RecurringField>,
    FormData
  >(
    async (previous, formData) => {
      const result = await saveRecurringAction(
        item?.id ?? null,
        previous,
        formData,
      );
      if (result.status === "saved") onDone();
      return result;
    },
    { status: "idle" },
  );
  const fieldError = (field: RecurringField) =>
    errorText(state.fieldErrors?.[field]);

  return (
    <form action={formAction} noValidate className="flex flex-col gap-5">
      <FieldGroup className="gap-5">
        <Chips
          name="kind"
          legend={t("form.kind")}
          values={kinds}
          value={kind}
          onChange={setKind}
          label={(value) => t(`kinds.${value}`)}
        />
        <Field data-invalid={fieldError("label") ? true : undefined}>
          <FieldLabel htmlFor={`${id}-label`}>{t("form.label")}</FieldLabel>
          <Input
            id={`${id}-label`}
            name="label"
            value={label}
            onChange={(change) => setLabel(change.target.value)}
            maxLength={BUDGET_LABEL_MAX}
            autoComplete="off"
            placeholder={t(`form.labelPlaceholder.${kind}`)}
            aria-invalid={fieldError("label") ? true : undefined}
            className="h-11"
          />
          {fieldError("label") ? (
            <FieldError>{fieldError("label")}</FieldError>
          ) : null}
        </Field>
        <AmountField
          id={id}
          value={amount}
          onChange={setAmount}
          error={fieldError("amount")}
        />
        <Chips
          name="frequency"
          legend={t("form.frequency")}
          values={BUDGET_FREQUENCIES}
          value={frequency}
          onChange={setFrequency}
          label={(value) => t(`frequencies.${value}`)}
        />
        {kind === "expense" ? (
          <CategoryField
            value={category}
            onChange={setCategory}
            error={fieldError("category")}
          />
        ) : null}
        {kind === "transfer" ? (
          <>
            <AccountField
              name="accountId"
              legend={t("form.from")}
              value={accountId}
              onChange={setAccountId}
              optional={false}
              error={fieldError("accountId")}
            />
            <AccountField
              name="toAccountId"
              legend={t("form.to")}
              value={toAccountId}
              onChange={setToAccountId}
              optional={false}
              exclude={accountId}
              error={fieldError("toAccountId")}
            />
          </>
        ) : accounts.length > 0 ? (
          <AccountField
            name="accountId"
            legend={t("form.account")}
            value={accountId}
            onChange={setAccountId}
            optional
          />
        ) : null}
        <div className="flex flex-wrap gap-4">
          <Field
            data-invalid={fieldError("startsOn") ? true : undefined}
            className="w-auto"
          >
            <FieldLabel htmlFor={`${id}-starts`}>
              {t(`form.startsOn.${kind}`)}
            </FieldLabel>
            <Input
              id={`${id}-starts`}
              name="startsOn"
              type="date"
              value={startsOn}
              onChange={(change) => setStartsOn(change.target.value)}
              aria-invalid={fieldError("startsOn") ? true : undefined}
              className="h-11 w-auto"
            />
            {fieldError("startsOn") ? (
              <FieldError>{fieldError("startsOn")}</FieldError>
            ) : null}
          </Field>
          <Field
            data-invalid={fieldError("endsOn") ? true : undefined}
            className="w-auto"
          >
            <FieldLabel htmlFor={`${id}-ends`}>
              {t("form.endsOn")}{" "}
              <span className="font-normal text-muted-foreground">
                {t("form.optional")}
              </span>
            </FieldLabel>
            <Input
              id={`${id}-ends`}
              name="endsOn"
              type="date"
              value={endsOn}
              min={startsOn}
              onChange={(change) => setEndsOn(change.target.value)}
              aria-invalid={fieldError("endsOn") ? true : undefined}
              className="h-11 w-auto"
            />
            {fieldError("endsOn") ? (
              <FieldError>{fieldError("endsOn")}</FieldError>
            ) : null}
          </Field>
        </div>
        <FieldDescription>
          {t(item ? "form.editHint" : "form.startsOnHint")}
        </FieldDescription>
      </FieldGroup>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {errorText(state.error)}
        </p>
      ) : null}
      <DialogFooter>
        {item ? (
          <DeleteButton type="recurring" itemId={item.id} onDeleted={onDone} />
        ) : null}
        <Button type="submit" className="h-11" disabled={pending}>
          {pending ? (
            <LoaderCircle aria-hidden="true" className="animate-spin" />
          ) : null}
          {item ? t("form.save") : t("form.add")}
        </Button>
      </DialogFooter>
    </form>
  );
}
