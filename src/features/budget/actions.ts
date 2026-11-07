"use server";

import { recordIdSchema } from "@/features/goals/schemas";
import { requireUser } from "@/server/auth/session";
import {
  deleteEntry,
  deleteRecurring,
  eraseBudget,
  saveEntry,
  saveRecurring,
} from "@/server/budget/service";
import {
  entryFieldErrors,
  entryFormSchema,
  recurringFieldErrors,
  recurringFormSchema,
  type BudgetError,
  type EntryField,
  type RecurringField,
} from "./rules";
import { revalidateBudget } from "./revalidate";

// Points d'entrée publics : session, identifiants et saisies sont revalidés ici.

export type BudgetFormState<Field extends string> = {
  status: "idle" | "error" | "saved";
  error?: BudgetError;
  fieldErrors?: Partial<Record<Field, BudgetError>>;
};

/** Identifiant facultatif (null : ajout) ; undefined s'il est invalide. */
function idOf(value: string | null) {
  if (value === null) return null;
  const parsed = recordIdSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

/** Ajoute (`entryId` null) ou modifie une transaction. */
export async function saveEntryAction(
  entryId: string | null,
  _previous: BudgetFormState<EntryField>,
  formData: FormData,
): Promise<BudgetFormState<EntryField>> {
  const user = await requireUser();
  const id = idOf(entryId);
  if (id === undefined) return { status: "error", error: "notFound" };
  const parsed = entryFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { status: "error", fieldErrors: entryFieldErrors(parsed.error) };
  }
  try {
    const result = await saveEntry(user.id, id, parsed.data);
    if (!result.ok) return { status: "error", error: result.error };
  } catch (error) {
    console.error("Enregistrement du mouvement impossible", error);
    return { status: "error", error: "unexpected" };
  }
  revalidateBudget();
  return { status: "saved" };
}

/** Ajoute (`recurringId` null) ou modifie un montant fixe. */
export async function saveRecurringAction(
  recurringId: string | null,
  _previous: BudgetFormState<RecurringField>,
  formData: FormData,
): Promise<BudgetFormState<RecurringField>> {
  const user = await requireUser();
  const id = idOf(recurringId);
  if (id === undefined) return { status: "error", error: "notFound" };
  const parsed = recurringFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: recurringFieldErrors(parsed.error),
    };
  }
  try {
    const result = await saveRecurring(user.id, id, parsed.data);
    if (!result.ok) return { status: "error", error: result.error };
  } catch (error) {
    console.error("Enregistrement du montant fixe impossible", error);
    return { status: "error", error: "unexpected" };
  }
  revalidateBudget();
  return { status: "saved" };
}

/**
 * Supprime une transaction (`entry`) ou un montant fixe (`recurring`) ; ses paiements
 * passés restent, sauf avec `withHistory`.
 */
export async function deleteBudgetItemAction(
  type: "entry" | "recurring",
  itemId: string,
  withHistory = false,
) {
  const user = await requireUser();
  const id = recordIdSchema.safeParse(itemId);
  if (!id.success) return false;
  try {
    const deleted =
      type === "recurring"
        ? await deleteRecurring(user.id, id.data, withHistory === true)
        : await deleteEntry(user.id, id.data);
    revalidateBudget();
    return deleted;
  } catch (error) {
    console.error("Suppression impossible dans le budget", error);
    return false;
  }
}

/** « Effacer mon budget ». */
export async function eraseBudgetAction() {
  const user = await requireUser();
  try {
    await eraseBudget(user.id);
  } catch (error) {
    console.error("Effacement du budget impossible", error);
    return false;
  }
  revalidateBudget();
  return true;
}
