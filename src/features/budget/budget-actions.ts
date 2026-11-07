"use server";

import { z } from "zod";
import { recordIdSchema } from "@/features/goals/schemas";
import { requireUser } from "@/server/auth/session";
import {
  adjustBalance,
  deleteAccount,
  deleteGoal,
  saveAccount,
  saveGoal,
} from "@/server/budget/accounts";
import {
  createCategory,
  deleteCategory,
  prepareAnnual,
  setCategoryPlan,
  setRollover,
  setupBudget,
} from "@/server/budget/plans";
import { getBudgetBase, saveEntry } from "@/server/budget/service";
import {
  exportEntries,
  getImportHistory,
  importEntries,
} from "@/server/budget/transactions";
import {
  accountFieldErrors,
  accountFormSchema,
  type AccountField,
} from "./accounts";
import {
  CATEGORY_NAME_MAX,
  CUSTOM_GROUPS,
  CUSTOM_ICONS,
  isCategoryKey,
} from "./categories";
import { goalFieldErrors, goalFormSchema, type GoalField } from "./goals";
import { importSchema } from "./import";
import { parseAmount, parseSignedAmount, type BudgetError } from "./rules";
import { revalidateBudget } from "./revalidate";
import { setupSchema } from "./setup";

// Points d'entrée publics du budget complet : session, identifiants et saisies
// sont revalidés ici. Le serveur relit ce qui lui appartient, jamais le navigateur.

export type BudgetResult = { ok: true } | { ok: false; error: BudgetError };

async function guarded(
  run: () => Promise<BudgetResult>,
): Promise<BudgetResult> {
  try {
    const result = await run();
    if (result.ok) revalidateBudget();
    return result;
  } catch (error) {
    console.error("Budget : action impossible", error);
    return { ok: false, error: "unexpected" };
  }
}

const monthSchema = z.iso.date();

const planSchema = z.strictObject({
  category: z.string().refine(isCategoryKey),
  month: monthSchema,
  amount: z.string().max(40),
  onlyThisMonth: z.boolean(),
});

/** Le montant prévu d'une catégorie (0 : retirée du plan). */
export async function setCategoryPlanAction(
  input: unknown,
): Promise<BudgetResult> {
  const user = await requireUser();
  const parsed = planSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "unexpected" };
  const text = parsed.data.amount.trim();
  const amountCents = text === "" || text === "0" ? 0 : parseAmount(text);
  if (amountCents === null) return { ok: false, error: "amountInvalid" };
  return guarded(() =>
    setCategoryPlan(user.id, { ...parsed.data, amountCents }),
  );
}

const applyPlanSchema = z.strictObject({
  month: monthSchema,
  items: z
    .array(
      z.strictObject({
        category: z.string().refine(isCategoryKey),
        cents: z.number().int().min(1).max(100_000_000),
      }),
    )
    .min(1)
    .max(30),
});

/** Applique une proposition de répartition : chaque montant reste modifiable. */
export async function applyPlanAction(input: unknown): Promise<BudgetResult> {
  const user = await requireUser();
  const parsed = applyPlanSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "unexpected" };
  return guarded(async () => {
    for (const item of parsed.data.items) {
      const result = await setCategoryPlan(user.id, {
        category: item.category,
        month: parsed.data.month,
        amountCents: item.cents,
        onlyThisMonth: false,
      });
      if (!result.ok) return result;
    }
    return { ok: true };
  });
}

const rolloverSchema = z.strictObject({
  category: z.string().refine(isCategoryKey),
  month: monthSchema,
  enabled: z.boolean(),
});

/** Active ou coupe le report d'une catégorie. */
export async function setRolloverAction(input: unknown): Promise<BudgetResult> {
  const user = await requireUser();
  const parsed = rolloverSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "unexpected" };
  return guarded(() => setRollover(user.id, parsed.data));
}

const annualSchema = z.strictObject({
  category: z.string().refine(isCategoryKey),
  month: monthSchema,
  amountCents: z.number().int().min(1).max(100_000_000),
});

/** Prépare une dépense annuelle : un peu chaque mois, avec le report. */
export async function prepareAnnualAction(
  input: unknown,
): Promise<BudgetResult> {
  const user = await requireUser();
  const parsed = annualSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "unexpected" };
  return guarded(() => prepareAnnual(user.id, parsed.data));
}

const categorySchema = z.strictObject({
  name: z.string().trim().min(1).max(CATEGORY_NAME_MAX),
  group: z.enum(CUSTOM_GROUPS),
  icon: z.enum(CUSTOM_ICONS),
});

/** Ajoute une catégorie personnelle. */
export async function createCategoryAction(
  input: unknown,
): Promise<BudgetResult> {
  const user = await requireUser();
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "labelRequired" };
  return guarded(() => createCategory(user.id, parsed.data));
}

/** Supprime une catégorie personnelle : ses transactions passent dans « Autre ». */
export async function deleteCategoryAction(
  key: unknown,
): Promise<BudgetResult> {
  const user = await requireUser();
  const parsed = recordIdSchema.safeParse(key);
  if (!parsed.success) return { ok: false, error: "notFound" };
  return guarded(async () =>
    (await deleteCategory(user.id, parsed.data))
      ? { ok: true }
      : { ok: false, error: "notFound" },
  );
}

/** La mise en route : revenu, paiements fixes et montants prévus. */
export async function setupBudgetAction(input: unknown): Promise<BudgetResult> {
  const user = await requireUser();
  const parsed = setupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "unexpected" };
  return guarded(async () => {
    const { today } = await getBudgetBase(user.id);
    return setupBudget(user.id, parsed.data, today);
  });
}

export type FormResult<Field extends string> = {
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

/** Ajoute (`accountId` null) ou modifie un compte. */
export async function saveAccountAction(
  accountId: string | null,
  _previous: FormResult<AccountField>,
  formData: FormData,
): Promise<FormResult<AccountField>> {
  const user = await requireUser();
  const id = idOf(accountId);
  if (id === undefined) return { status: "error", error: "notFound" };
  const parsed = accountFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { status: "error", fieldErrors: accountFieldErrors(parsed.error) };
  }
  const result = await guarded(() => saveAccount(user.id, id, parsed.data));
  return result.ok
    ? { status: "saved" }
    : { status: "error", error: result.error };
}

const adjustSchema = z.strictObject({
  accountId: z.uuid(),
  balance: z.string().max(40),
});

/** « Mettre à jour le solde » d'un compte. */
export async function adjustBalanceAction(
  input: unknown,
): Promise<BudgetResult> {
  const user = await requireUser();
  const parsed = adjustSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "unexpected" };
  const target = parseSignedAmount(parsed.data.balance);
  if (target === null) return { ok: false, error: "amountInvalid" };
  return guarded(() => adjustBalance(user.id, parsed.data.accountId, target));
}

/** Supprime un compte. */
export async function deleteAccountAction(id: unknown): Promise<BudgetResult> {
  const user = await requireUser();
  const parsed = recordIdSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: "notFound" };
  return guarded(async () =>
    (await deleteAccount(user.id, parsed.data))
      ? { ok: true }
      : { ok: false, error: "notFound" },
  );
}

/** Ajoute (`goalId` null) ou modifie un objectif d'épargne. */
export async function saveGoalAction(
  goalId: string | null,
  _previous: FormResult<GoalField>,
  formData: FormData,
): Promise<FormResult<GoalField>> {
  const user = await requireUser();
  const id = idOf(goalId);
  if (id === undefined) return { status: "error", error: "notFound" };
  const parsed = goalFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { status: "error", fieldErrors: goalFieldErrors(parsed.error) };
  }
  const result = await guarded(() => saveGoal(user.id, id, parsed.data));
  return result.ok
    ? { status: "saved" }
    : { status: "error", error: result.error };
}

/** Supprime un objectif d'épargne. */
export async function deleteGoalAction(id: unknown): Promise<BudgetResult> {
  const user = await requireUser();
  const parsed = recordIdSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: "notFound" };
  return guarded(async () =>
    (await deleteGoal(user.id, parsed.data))
      ? { ok: true }
      : { ok: false, error: "notFound" },
  );
}

const contributeSchema = z.strictObject({
  goalId: z.uuid(),
  amount: z.string().max(40),
  date: z.iso.date(),
});

/** « Mettre de côté » pour un objectif : une transaction d'épargne liée. */
export async function contributeToGoalAction(
  input: unknown,
): Promise<BudgetResult> {
  const user = await requireUser();
  const parsed = contributeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "unexpected" };
  const amountCents = parseAmount(parsed.data.amount);
  if (amountCents === null) return { ok: false, error: "amountInvalid" };
  return guarded(async () => {
    const saved = await saveEntry(user.id, null, {
      kind: "expense",
      category: "savings",
      amountCents,
      note: null,
      occurredOn: parsed.data.date,
      accountId: null,
      toAccountId: null,
      goalId: parsed.data.goalId,
    });
    return saved.ok ? { ok: true } : saved;
  });
}

/** Le relevé : ce qu'on sait déjà des commerçants, pour proposer une catégorie. */
export async function getImportHistoryAction() {
  const user = await requireUser();
  return getImportHistory(user.id);
}

/** Importe les lignes retenues d'un relevé. */
export async function importEntriesAction(input: unknown) {
  const user = await requireUser();
  const parsed = importSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false as const, error: "unexpected" as const };
  try {
    const result = await importEntries(user.id, parsed.data);
    if (result.ok) revalidateBudget();
    return result;
  } catch (error) {
    console.error("Budget : import impossible", error);
    return { ok: false as const, error: "unexpected" as const };
  }
}

/** Toutes les transactions, pour « Exporter ». */
export async function exportEntriesAction() {
  const user = await requireUser();
  return exportEntries(user.id);
}
