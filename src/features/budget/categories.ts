import { z } from "zod";

// Les catégories du budget (décision du fondateur, 2026-11-04) : celles de Get iT,
// rangées en trois groupes (essentiels, envies, épargne et dettes, comme le 50/30/20),
// et les catégories personnelles. Liste alignée sur la migration
// 20261118120000_budget_complete (un test le vérifie).

export const BUDGET_GROUPS = ["needs", "wants", "savings"] as const;
export type BudgetGroup = (typeof BUDGET_GROUPS)[number];

/** Le groupe de chaque catégorie de Get iT, dans l'ordre où elles s'affichent. */
export const CATEGORY_GROUPS = {
  housing: "needs",
  utilities: "needs",
  phone: "needs",
  groceries: "needs",
  transport: "needs",
  insurance: "needs",
  health: "needs",
  children: "needs",
  fees: "needs",
  taxes: "needs",
  restaurants: "wants",
  leisure: "wants",
  subscriptions: "wants",
  shopping: "wants",
  personal: "wants",
  travel: "wants",
  gifts: "wants",
  pets: "wants",
  education: "wants",
  other: "wants",
  savings: "savings",
  debt: "savings",
} as const satisfies Record<string, BudgetGroup>;

export type BuiltInCategory = keyof typeof CATEGORY_GROUPS;
export const BUDGET_CATEGORIES = Object.keys(
  CATEGORY_GROUPS,
) as BuiltInCategory[];

/** Une catégorie personnelle choisit son groupe (l'épargne a ses objectifs). */
export const CUSTOM_GROUPS = ["needs", "wants"] as const;
export const CUSTOM_ICONS = [
  "tag",
  "star",
  "heart",
  "dumbbell",
  "music",
  "gamepad",
  "book",
  "wrench",
  "shirt",
  "baby",
  "plane",
  "coffee",
] as const;
export type CustomIcon = (typeof CUSTOM_ICONS)[number];

export const MAX_CUSTOM_CATEGORIES = 30;
export const CATEGORY_NAME_MAX = 30;

/** Une catégorie telle que l'affiche le budget. */
export type CategoryInfo = {
  key: string;
  group: BudgetGroup;
  /** Nom d'une catégorie personnelle ; null : son nom vient des traductions. */
  name: string | null;
  icon: CustomIcon | null;
};

export const isBuiltInCategory = (value: unknown): value is BuiltInCategory =>
  BUDGET_CATEGORIES.some((key) => key === value);

const uuid = z.uuid();

/** Une catégorie de Get iT, ou l'identifiant d'une catégorie personnelle. */
export const isCategoryKey = (value: unknown): value is string =>
  isBuiltInCategory(value) || uuid.safeParse(value).success;

/** Toutes les catégories : celles de Get iT, puis les personnelles dans leur groupe. */
export function categoryList(
  custom: readonly {
    key: string;
    name: string | null;
    group: string | null;
    icon: string | null;
  }[],
): CategoryInfo[] {
  const own: CategoryInfo[] = [];
  for (const row of custom) {
    if (!row.name) continue;
    own.push({
      key: row.key,
      name: row.name,
      group: row.group === "needs" ? "needs" : "wants",
      icon: CUSTOM_ICONS.find((icon) => icon === row.icon) ?? "tag",
    });
  }
  const builtIn = BUDGET_CATEGORIES.map((key): CategoryInfo => ({
    key,
    group: CATEGORY_GROUPS[key],
    name: null,
    icon: null,
  }));
  return BUDGET_GROUPS.flatMap((group) => [
    ...builtIn.filter((entry) => entry.group === group),
    ...own.filter((entry) => entry.group === group),
  ]);
}

/** Le groupe d'une catégorie ; une catégorie inconnue compte comme « Autre ». */
export function groupOf(
  key: string | null,
  categories: readonly CategoryInfo[],
): BudgetGroup {
  return categories.find((entry) => entry.key === key)?.group ?? "wants";
}
