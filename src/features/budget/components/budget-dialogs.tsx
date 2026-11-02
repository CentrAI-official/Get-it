"use client";

import { LoaderCircle, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useActionState, useId, useState, useTransition } from "react";
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
import { amountField } from "../format";
import { CATEGORY_ICONS } from "../icons";
import {
  BUDGET_CATEGORIES,
  BUDGET_FREQUENCIES,
  BUDGET_KINDS,
  BUDGET_LABEL_MAX,
  BUDGET_NOTE_MAX,
  type BudgetCategory,
  type BudgetEntryRow,
  type BudgetError,
  type BudgetFrequency,
  type BudgetKind,
  type BudgetRecurringRow,
  type EntryField,
  type RecurringField,
} from "../rules";

const chip =
  "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50";
const chipOn = "border-primary bg-primary/15 text-foreground";
const chipOff =
  "border-foreground/10 text-muted-foreground hover:text-foreground";

/** Un choix parmi des pastilles (type, catégorie, fréquence), gardé dans un champ caché. */
function Chips<Value extends string>({
  name,
  legend,
  values,
  value,
  onChange,
  label,
  icon,
  error,
}: {
  name: string;
  legend: string;
  values: readonly Value[];
  value: Value | null;
  onChange: (value: Value) => void;
  label: (value: Value) => string;
  icon?: (value: Value) => React.ComponentType<{ className?: string }>;
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
        {values.map((entry) => {
          const Icon = icon?.(entry);
          return (
            <button
              key={entry}
              type="button"
              role="radio"
              aria-checked={value === entry}
              onClick={() => onChange(entry)}
              className={cn(chip, value === entry ? chipOn : chipOff)}
            >
              {Icon ? <Icon aria-hidden="true" className="size-4" /> : null}
              {label(entry)}
            </button>
          );
        })}
      </div>
      {error ? <FieldError>{error}</FieldError> : null}
    </FieldSet>
  );
}

/** Champ du montant, en grand, avec le symbole de la devise. */
function AmountField({
  id,
  value,
  onChange,
  error,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  error: string | null;
}) {
  const t = useTranslations("Budget.form");
  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={`${id}-amount`}>{t("amount")}</FieldLabel>
      <div className="relative">
        <Input
          id={`${id}-amount`}
          name="amount"
          value={value}
          onChange={(change) => onChange(change.target.value)}
          inputMode="decimal"
          autoComplete="off"
          placeholder={t("amountPlaceholder")}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-amount-error` : undefined}
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
        <FieldError id={`${id}-amount-error`}>{error}</FieldError>
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

/** Ajouter ou modifier une dépense ou un revenu au jour le jour. */
export function EntryDialog({
  open,
  onOpenChange,
  entry,
  kind,
  today,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Le mouvement à modifier, ou null pour en ajouter un. */
  entry: BudgetEntryRow | null;
  /** Type proposé pour un nouveau mouvement. */
  kind: BudgetKind;
  today: string;
}) {
  const t = useTranslations("Budget.form");
  const current = entry?.kind ?? kind;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {entry ? t(`editTitle.${current}`) : t(`addTitle.${current}`)}
          </DialogTitle>
          <DialogDescription>{t("entryDescription")}</DialogDescription>
        </DialogHeader>
        <EntryForm
          entry={entry}
          kind={current}
          today={today}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function EntryForm({
  entry,
  kind: initialKind,
  today,
  onDone,
}: {
  entry: BudgetEntryRow | null;
  kind: BudgetKind;
  today: string;
  onDone: () => void;
}) {
  const t = useTranslations("Budget");
  const locale = useLocale();
  const id = useId();
  const errorText = useErrorText();
  const [kind, setKind] = useState<BudgetKind>(initialKind);
  const [amount, setAmount] = useState(
    entry ? amountField(entry.amountCents, locale) : "",
  );
  const [category, setCategory] = useState<BudgetCategory | null>(
    entry?.category ?? null,
  );
  const [date, setDate] = useState(entry?.occurredOn ?? today);
  const [note, setNote] = useState(entry?.note ?? "");
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

  return (
    <form action={formAction} noValidate className="flex flex-col gap-5">
      <FieldGroup className="gap-5">
        <Chips
          name="kind"
          legend={t("form.kind")}
          values={BUDGET_KINDS}
          value={kind}
          onChange={setKind}
          label={(value) => t(`kinds.${value}`)}
        />
        <AmountField
          id={id}
          value={amount}
          onChange={setAmount}
          error={fieldError("amount")}
        />
        {kind === "expense" ? (
          <Chips
            name="category"
            legend={t("form.category")}
            values={BUDGET_CATEGORIES}
            value={category}
            onChange={setCategory}
            label={(value) => t(`categories.${value}`)}
            icon={(value) => CATEGORY_ICONS[value]}
            error={fieldError("category")}
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
        <Button type="submit" disabled={pending}>
          {pending ? (
            <LoaderCircle aria-hidden="true" className="animate-spin" />
          ) : null}
          {entry ? t("form.save") : t("form.add")}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Ajouter ou modifier un revenu ou une dépense fixe. */
export function RecurringDialog({
  open,
  onOpenChange,
  item,
  kind,
  today,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: BudgetRecurringRow | null;
  kind: BudgetKind;
  today: string;
}) {
  const t = useTranslations("Budget.form");
  const current = item?.kind ?? kind;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {item
              ? t(`editFixedTitle.${current}`)
              : t(`addFixedTitle.${current}`)}
          </DialogTitle>
          <DialogDescription>{t("fixedDescription")}</DialogDescription>
        </DialogHeader>
        <RecurringForm
          item={item}
          kind={current}
          today={today}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function RecurringForm({
  item,
  kind: initialKind,
  today,
  onDone,
}: {
  item: BudgetRecurringRow | null;
  kind: BudgetKind;
  today: string;
  onDone: () => void;
}) {
  const t = useTranslations("Budget");
  const locale = useLocale();
  const id = useId();
  const errorText = useErrorText();
  const [kind, setKind] = useState<BudgetKind>(initialKind);
  const [label, setLabel] = useState(item?.label ?? "");
  const [amount, setAmount] = useState(
    item ? amountField(item.amountCents, locale) : "",
  );
  const [frequency, setFrequency] = useState<BudgetFrequency>(
    item?.frequency ?? "monthly",
  );
  const [category, setCategory] = useState<BudgetCategory | null>(
    item?.category ?? null,
  );
  const [startsOn, setStartsOn] = useState(item?.startsOn ?? today);
  const [endsOn, setEndsOn] = useState(item?.endsOn ?? "");
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
          values={BUDGET_KINDS}
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
          <Chips
            name="category"
            legend={t("form.category")}
            values={BUDGET_CATEGORIES}
            value={category}
            onChange={setCategory}
            label={(value) => t(`categories.${value}`)}
            icon={(value) => CATEGORY_ICONS[value]}
            error={fieldError("category")}
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
        <FieldDescription>{t("form.startsOnHint")}</FieldDescription>
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
        <Button type="submit" disabled={pending}>
          {pending ? (
            <LoaderCircle aria-hidden="true" className="animate-spin" />
          ) : null}
          {item ? t("form.save") : t("form.add")}
        </Button>
      </DialogFooter>
    </form>
  );
}
