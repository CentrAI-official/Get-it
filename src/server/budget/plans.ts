import "server-only";
import { randomUUID } from "node:crypto";
import {
  isBuiltInCategory,
  MAX_CUSTOM_CATEGORIES,
  type CustomIcon,
} from "@/features/budget/categories";
import { plannedFor } from "@/features/budget/plan";
import type { SetupInput } from "@/features/budget/setup";
import {
  monthStart,
  MAX_RECURRING,
  type BudgetError,
} from "@/features/budget/rules";
import { toDbDate } from "@/lib/dates";
import { db } from "@/server/db";
import { loadPlans } from "./service";

// Le plan du budget et les catégories. Chaque fonction reçoit l'userId de la session.

type Result = { ok: true } | { ok: false; error: BudgetError };

/** Une catégorie de Get iT, ou une catégorie personnelle de la personne. */
async function ownsCategory(userId: string, key: string) {
  if (isBuiltInCategory(key)) return true;
  const row = await db.budgetCategorySetting.findUnique({
    where: { userId_key: { userId, key } },
    select: { name: true },
  });
  return Boolean(row?.name);
}

/**
 * Le montant prévu d'une catégorie, à partir de ce mois. Avec `onlyThisMonth`, le
 * mois suivant reprend le montant d'avant (Noël, un voyage).
 */
export async function setCategoryPlan(
  userId: string,
  input: {
    category: string;
    month: string;
    amountCents: number;
    onlyThisMonth: boolean;
  },
): Promise<Result> {
  if (!(await ownsCategory(userId, input.category))) {
    return { ok: false, error: "notFound" };
  }
  const month = monthStart(input.month);
  const upsert = (on: string, amountCents: number) =>
    db.budgetPlan.upsert({
      where: {
        userId_category_month: {
          userId,
          category: input.category,
          month: toDbDate(on),
        },
      },
      update: { amountCents },
      create: {
        userId,
        category: input.category,
        month: toDbDate(on),
        amountCents,
      },
    });
  if (input.onlyThisMonth) {
    const following = monthStart(month, 1);
    const plans = await loadPlans(userId);
    const hasNext = plans.some(
      (row) => row.category === input.category && row.month === following,
    );
    if (!hasNext) {
      const previous = plannedFor(
        plans.filter(
          (row) => !(row.category === input.category && row.month === month),
        ),
        input.category,
        month,
      );
      await upsert(following, previous ?? 0);
    }
  }
  await upsert(month, input.amountCents);
  return { ok: true };
}

/** Le report d'une catégorie : ce qui reste s'accumule d'un mois à l'autre. */
export async function setRollover(
  userId: string,
  input: { category: string; month: string; enabled: boolean },
): Promise<Result> {
  if (!(await ownsCategory(userId, input.category))) {
    return { ok: false, error: "notFound" };
  }
  const rolloverFrom = input.enabled ? toDbDate(monthStart(input.month)) : null;
  await db.budgetCategorySetting.upsert({
    where: { userId_key: { userId, key: input.category } },
    update: { rolloverFrom },
    create: { userId, key: input.category, rolloverFrom },
  });
  return { ok: true };
}

/** Une dépense annuelle à préparer : un peu chaque mois, avec le report. */
export async function prepareAnnual(
  userId: string,
  input: { category: string; month: string; amountCents: number },
): Promise<Result> {
  const planned = await setCategoryPlan(userId, {
    ...input,
    onlyThisMonth: false,
  });
  if (!planned.ok) return planned;
  return setRollover(userId, {
    category: input.category,
    month: input.month,
    enabled: true,
  });
}

/** Ajoute une catégorie personnelle. */
export async function createCategory(
  userId: string,
  input: { name: string; group: "needs" | "wants"; icon: CustomIcon },
): Promise<Result> {
  const count = await db.budgetCategorySetting.count({
    where: { userId, name: { not: null } },
  });
  if (count >= MAX_CUSTOM_CATEGORIES) {
    return { ok: false, error: "categoryLimit" };
  }
  await db.budgetCategorySetting.create({
    data: {
      userId,
      key: randomUUID(),
      name: input.name,
      group: input.group,
      icon: input.icon,
    },
  });
  return { ok: true };
}

/** Supprime une catégorie personnelle : ses transactions passent dans « Autre ». */
export async function deleteCategory(userId: string, key: string) {
  if (isBuiltInCategory(key)) return false;
  return db.$transaction(async (tx) => {
    const { count } = await tx.budgetCategorySetting.deleteMany({
      where: { userId, key, name: { not: null } },
    });
    if (count === 0) return false;
    await tx.budgetEntry.updateMany({
      where: { userId, category: key },
      data: { category: "other" },
    });
    await tx.budgetRecurring.updateMany({
      where: { userId, category: key },
      data: { category: "other" },
    });
    await tx.budgetPlan.deleteMany({ where: { userId, category: key } });
    return true;
  });
}

/** La mise en route : le revenu, les paiements fixes et les montants prévus, d'un seul coup. */
export async function setupBudget(
  userId: string,
  input: SetupInput,
  month: string,
): Promise<Result> {
  const count = await db.budgetRecurring.count({ where: { userId } });
  if (count + input.bills.length + 1 > MAX_RECURRING) {
    return { ok: false, error: "recurringLimit" };
  }
  await db.$transaction([
    db.budgetRecurring.create({
      data: {
        userId,
        kind: "income",
        label: input.income.label,
        category: null,
        amountCents: input.income.amountCents,
        frequency: input.income.frequency,
        startsOn: toDbDate(input.income.startsOn),
      },
    }),
    db.budgetRecurring.createMany({
      data: input.bills.map((bill) => ({
        userId,
        kind: "expense",
        label: bill.label,
        category: bill.category,
        amountCents: bill.amountCents,
        frequency: "monthly",
        startsOn: toDbDate(bill.startsOn),
      })),
    }),
    db.budgetPlan.createMany({
      data: input.plans.map((plan) => ({
        userId,
        category: plan.category,
        month: toDbDate(monthStart(month)),
        amountCents: plan.amountCents,
      })),
      skipDuplicates: true,
    }),
  ]);
  return { ok: true };
}
