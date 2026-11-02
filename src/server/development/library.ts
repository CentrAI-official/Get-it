import "server-only";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { planKindOf } from "@/features/development/catalogue";
import { storedPlanSchema, type PlanItem } from "@/features/development/plan";
import {
  addPlanItem,
  mealItemName,
  replacePlanItem,
  type PlanEditError,
} from "@/features/development/plan-edit";
import type {
  Answers,
  DevelopmentKind,
} from "@/features/development/questionnaires";
import {
  contentIn,
  localizedContentSchema,
  MEALS,
  type LibraryKind,
  type LibraryPillar,
} from "@/features/library/rules";
import { db } from "@/server/db";

// « Ajouter à mon plan » et « Remplacer… » depuis une fiche du catalogue :
// l'élément (publié) est revérifié en base, le plan aussi ; aucune IA.
// Chaque fonction reçoit l'userId de la session.

export type Meal = (typeof MEALS)[number];

export type PlanTarget = {
  /** Plan qui reçoit cet élément (entraînement, nutrition, mental, social). */
  planKind: DevelopmentKind;
  hasPlan: boolean;
  /** Séances de la semaine type, avec leurs éléments (pour « Remplacer… »). */
  days: {
    weekday: number;
    title: string;
    items: { index: number; name: string; ref: string | null }[];
  }[];
  /** Allergies déclarées dans le plan de nutrition que la recette contient. */
  allergyWarnings: string[];
};

type LibraryRow = {
  id: string;
  kind: LibraryKind;
  pillar: LibraryPillar;
  tags: string[];
  content: unknown;
  minutes: number | null;
};

async function libraryItem(userId: string, id: string) {
  const [row, profile] = await Promise.all([
    db.libraryItem.findUnique({
      where: { id },
      select: {
        id: true,
        kind: true,
        pillar: true,
        status: true,
        tags: true,
        content: true,
        minutes: true,
      },
    }),
    db.profile.findUnique({ where: { id: userId }, select: { role: true } }),
  ]);
  if (!row) return null;
  if (row.status !== "published" && profile?.role !== "admin") return null;
  return row as LibraryRow & { status: string };
}

async function planOf(userId: string, kind: DevelopmentKind) {
  const row = await db.developmentPlan.findUnique({
    where: { userId_kind: { userId, kind } },
    select: { id: true, plan: true, answers: true },
  });
  const plan = row ? storedPlanSchema.safeParse(row.plan) : null;
  return row && plan?.success
    ? { id: row.id, plan: plan.data, answers: row.answers as Answers }
    : null;
}

/** Où cet élément peut aller dans le plan de la personne (fenêtre des boutons). */
export async function getPlanTarget(
  userId: string,
  item: { kind: LibraryKind; pillar: LibraryPillar; tags: string[] },
): Promise<PlanTarget> {
  const planKind = planKindOf(item.kind, item.pillar);
  const stored = await planOf(userId, planKind);
  const allergies = Array.isArray(stored?.answers.allergies)
    ? stored.answers.allergies
    : [];
  return {
    planKind,
    hasPlan: stored !== null,
    days: (stored?.plan.schedule ?? []).map((day) => ({
      weekday: day.weekday,
      title: day.title,
      items: day.items.map((entry, index) => ({
        index,
        name: entry.name,
        ref: entry.ref,
      })),
    })),
    allergyWarnings:
      item.kind === "recipe"
        ? allergies.filter((allergen) =>
            item.tags.includes(`allergen:${allergen}`),
          )
        : [],
  };
}

export type PlanEditResult =
  { ok: true } | { ok: false; error: PlanEditError | "notFound" | "noPlan" };

/** L'élément du plan tiré d'une fiche, dans la langue de la personne. */
async function planItemOf(
  row: LibraryRow,
  locale: Locale,
  meal: Meal | null,
): Promise<PlanItem | null> {
  const content = localizedContentSchema.safeParse(row.content);
  if (!content.success) return null;
  const [t, tMeals] = await Promise.all([
    getTranslations({ locale, namespace: "Library.planDefaults" }),
    getTranslations({ locale, namespace: "Library.values.meal" }),
  ]);
  const title = contentIn(content.data, locale).title;
  const detail =
    row.kind === "exercise"
      ? t("exercise")
      : row.kind === "recipe"
        ? t("recipe")
        : row.minutes
          ? t("tool", { minutes: row.minutes })
          : "";
  return {
    name:
      row.kind === "recipe" && meal ? mealItemName(tMeals(meal), title) : title,
    detail,
    ref: row.id,
  };
}

async function edit(
  userId: string,
  libraryId: string,
  change: (
    plan: NonNullable<Awaited<ReturnType<typeof planOf>>>,
    row: LibraryRow,
    locale: Locale,
  ) => Promise<ReturnType<typeof addPlanItem> | null>,
): Promise<PlanEditResult> {
  const row = await libraryItem(userId, libraryId);
  if (!row) return { ok: false, error: "notFound" };
  const stored = await planOf(userId, planKindOf(row.kind, row.pillar));
  if (!stored) return { ok: false, error: "noPlan" };
  const settings = await db.userSettings.findUnique({
    where: { userId },
    select: { locale: true },
  });
  const result = await change(stored, row, settings?.locale ?? "fr");
  if (!result) return { ok: false, error: "notFound" };
  if (!result.ok) return result;
  await db.developmentPlan.update({
    where: { id: stored.id },
    data: { plan: result.plan },
  });
  return { ok: true };
}

/** Ajoute une fiche à la séance d'un jour (la crée s'il n'y en a pas). */
export async function addLibraryItemToPlan(
  userId: string,
  libraryId: string,
  input: { weekday: number; meal: Meal | null },
) {
  return edit(userId, libraryId, async (stored, row, locale) => {
    const item = await planItemOf(row, locale, input.meal);
    if (!item) return null;
    const t = await getTranslations({
      locale,
      namespace: "Library.planDefaults.session",
    });
    return addPlanItem(stored.plan, {
      weekday: input.weekday,
      item,
      sessionTitle: t(row.kind),
    });
  });
}

/** Remplace un élément du plan par cette fiche (séries et repas gardés). */
export async function replaceInPlan(
  userId: string,
  libraryId: string,
  input: { weekday: number; index: number },
) {
  return edit(userId, libraryId, async (stored, row, locale) => {
    const item = await planItemOf(row, locale, null);
    if (!item) return null;
    return replacePlanItem(stored.plan, { ...input, item });
  });
}
