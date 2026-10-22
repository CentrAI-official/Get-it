"use client";

import { Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  useActionState,
  useId,
  useOptimistic,
  useTransition,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  initialItemFormState,
  ITEM_TITLE_MAX_LENGTH,
  type ItemFormState,
} from "../schemas";

type ChecklistItemProps = {
  id: string;
  title: string;
  done: boolean;
  /** Informations sous le titre (ex. échéance). */
  meta?: ReactNode;
  onToggle: (done: boolean) => Promise<void>;
  onDelete: () => Promise<void>;
  deleteLabel: string;
};

/** Élément cochable (jalon, tâche). La case réagit tout de suite, sans attendre le serveur. */
export function ChecklistItem({
  id,
  title,
  done,
  meta,
  onToggle,
  onDelete,
  deleteLabel,
}: ChecklistItemProps) {
  const [optimisticDone, setOptimisticDone] = useOptimistic(done);
  const [, startToggle] = useTransition();
  const [isDeleting, startDelete] = useTransition();
  const checkboxId = `item-${id}`;

  return (
    <li
      className={cn(
        "flex items-center gap-3 border-b border-white/8 py-1.5 transition-opacity",
        optimisticDone ? "text-muted-foreground" : null,
        isDeleting && "opacity-50",
      )}
    >
      <Checkbox
        id={checkboxId}
        className="size-6 rounded-full border-2 border-white/20 data-checked:glow-primary [&_svg]:size-3.5"
        checked={optimisticDone}
        onCheckedChange={(checked) =>
          startToggle(async () => {
            setOptimisticDone(checked === true);
            await onToggle(checked === true);
          })
        }
      />
      <label
        htmlFor={checkboxId}
        className="flex min-w-0 flex-1 cursor-pointer flex-col gap-0.5 py-1.5"
      >
        <span
          className={cn(
            "text-sm break-words",
            optimisticDone && "text-muted-foreground line-through",
          )}
        >
          {title}
        </span>
        {meta}
      </label>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={deleteLabel}
        disabled={isDeleting}
        onClick={() => startDelete(onDelete)}
        className="text-muted-foreground hover:text-destructive"
      >
        <Trash2 aria-hidden="true" />
      </Button>
    </li>
  );
}

type AddItemFormProps = {
  action: (state: ItemFormState, formData: FormData) => Promise<ItemFormState>;
  label: string;
  placeholder: string;
  submitLabel: string;
  /** Affiche un champ d'échéance facultatif. */
  dateLabel?: string;
  /** Échéance proposée par défaut (« AAAA-MM-JJ »). */
  defaultDate?: string;
};

/** Petit formulaire d'ajout en une ligne (jalon, tâche). */
export function AddItemForm({
  action,
  label,
  placeholder,
  submitLabel,
  dateLabel,
  defaultDate,
}: AddItemFormProps) {
  const t = useTranslations("Goals.errors");
  // Id uniques : Next garde la page précédente cachée dans le DOM
  const idPrefix = useId();
  const [state, formAction, pending] = useActionState(
    action,
    initialItemFormState,
  );
  const errorId = `${idPrefix}-error`;
  const error = state.status === "error" ? state.error : undefined;

  return (
    <form
      action={formAction}
      noValidate
      aria-label={label}
      className="@container flex flex-col gap-2"
    >
      {/* Une ligne si la place le permet ; sinon la date et le bouton passent dessous */}
      <div
        className={cn(
          "flex gap-2",
          dateLabel ? "flex-col @lg:flex-row" : "flex-row",
        )}
      >
        <label htmlFor={`${idPrefix}-title`} className="sr-only">
          {label}
        </label>
        <Input
          id={`${idPrefix}-title`}
          name="title"
          defaultValue={state.values?.title}
          placeholder={placeholder}
          maxLength={ITEM_TITLE_MAX_LENGTH}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="h-10 flex-1"
        />
        <div className="flex gap-2">
          {dateLabel ? (
            // Libellé visible quand la date passe sous le titre ; masqué sur une seule ligne
            <div className="flex min-w-0 flex-1 flex-col gap-1 @lg:w-44 @lg:flex-none">
              <label
                htmlFor={`${idPrefix}-date`}
                className="text-xs text-muted-foreground @lg:sr-only"
              >
                {dateLabel}
              </label>
              <Input
                id={`${idPrefix}-date`}
                name="dueDate"
                type="date"
                title={dateLabel}
                defaultValue={state.values?.dueDate ?? defaultDate}
                className="h-10"
              />
            </div>
          ) : null}
          <Button
            type="submit"
            variant="secondary"
            disabled={pending}
            className="h-10 self-end"
          >
            <Plus aria-hidden="true" />
            {submitLabel}
          </Button>
        </div>
      </div>
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {t(error)}
        </p>
      ) : null}
    </form>
  );
}
