import { z } from "zod";

// Catalogue Get iT de Mon développement (décision du fondateur, 2026-11-01) :
// exercices (Physique › Entraînement), recettes (Physique › Nutrition) et
// outils (Mental, Social). Ajouté par l'équipe (rôle admin) ; seuls les
// éléments publiés se montrent aux membres. Listes alignées sur la migration
// 20261112120000_library (un test le vérifie).

export const LIBRARY_KINDS = ["exercise", "recipe", "tool"] as const;
export type LibraryKind = (typeof LIBRARY_KINDS)[number];

export const LIBRARY_STATUSES = ["draft", "published"] as const;
export type LibraryStatus = (typeof LIBRARY_STATUSES)[number];

/** Pilier de chaque type : un outil est du mental ou du social. */
export const TOOL_PILLARS = ["mental", "social"] as const;
export type ToolPillar = (typeof TOOL_PILLARS)[number];
export type LibraryPillar = "physical" | ToolPillar;

// --- Filtres ----------------------------------------------------------------

export const MUSCLES = [
  "chest",
  "back",
  "shoulders",
  "biceps",
  "triceps",
  "quads",
  "hamstrings",
  "glutes",
  "calves",
  "core",
  "fullBody",
] as const;
export const PLACES = ["gym", "home"] as const;
export const EQUIPMENT = [
  "bodyweight",
  "dumbbells",
  "barbell",
  "cables",
  "machine",
  "kettlebell",
  "bands",
] as const;
export const LEVELS = ["beginner", "intermediate", "advanced"] as const;

export const MEALS = ["breakfast", "lunch", "dinner", "snack"] as const;
export const NUTRITION_GOALS = [
  "weightLoss",
  "muscleGain",
  "maintenance",
] as const;
export const DIETS = ["vegetarian", "vegan"] as const;
/** Allergènes prioritaires de Santé Canada : une recette dit ceux qu'elle contient. */
export const ALLERGENS = [
  "peanuts",
  "treeNuts",
  "milk",
  "eggs",
  "wheat",
  "soy",
  "sesame",
  "fish",
  "shellfish",
  "mustard",
  "sulphites",
] as const;

export const MENTAL_THEMES = [
  "stress",
  "discipline",
  "focus",
  "confidence",
  "sleep",
  "emotions",
] as const;
export const SOCIAL_THEMES = [
  "meetPeople",
  "communication",
  "networking",
  "relationships",
  "publicSpeaking",
] as const;

/**
 * Familles de filtres de chaque type, dans l'ordre de l'écran. Une recette
 * garde dans `allergen` ceux qu'elle **contient** ; le filtre des membres
 * les **exclut** (« sans arachides »).
 */
export const FILTER_GROUPS = {
  exercise: {
    muscle: MUSCLES,
    place: PLACES,
    equipment: EQUIPMENT,
    level: LEVELS,
  },
  recipe: {
    meal: MEALS,
    goal: NUTRITION_GOALS,
    diet: DIETS,
    allergen: ALLERGENS,
  },
  tool: {
    theme: [...MENTAL_THEMES, ...SOCIAL_THEMES],
  },
} as const satisfies Record<LibraryKind, Record<string, readonly string[]>>;

export type FilterGroup<K extends LibraryKind> =
  keyof (typeof FILTER_GROUPS)[K];

/** Thèmes d'un outil selon son pilier. */
export const TOOL_THEMES: Record<ToolPillar, readonly string[]> = {
  mental: MENTAL_THEMES,
  social: SOCIAL_THEMES,
};

/** Étiquette enregistrée : « famille:valeur » (« muscle:chest »). */
export const tagOf = (group: string, value: string) => `${group}:${value}`;

/** Toutes les étiquettes permises d'un type (et d'un pilier pour les outils). */
export function allowedTags(kind: LibraryKind, pillar?: ToolPillar) {
  const groups: Record<string, readonly string[]> =
    kind === "tool"
      ? { theme: TOOL_THEMES[pillar ?? "mental"] }
      : FILTER_GROUPS[kind];
  return new Set(
    Object.entries(groups).flatMap(([group, values]) =>
      values.map((value) => tagOf(group, value)),
    ),
  );
}

// --- Filtres choisis par un membre (adresse de la page) ---------------------

export type LibraryFilters = {
  /** Étiquettes exigées (au moins une par famille choisie). */
  include: Record<string, string[]>;
  /** Allergènes à exclure (recettes). */
  without: string[];
  q: string;
};

const listParam = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value.join(",") : (value ?? ""))
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

/**
 * Filtres lus dans l'adresse : chaque famille est une liste séparée par des
 * virgules (`?muscle=chest,back&sans=peanuts`) ; les valeurs inconnues sont
 * ignorées.
 */
export function parseFilters(
  kind: LibraryKind,
  params: Record<string, string | string[] | undefined>,
  pillar?: ToolPillar,
): LibraryFilters {
  const groups: Record<string, readonly string[]> =
    kind === "tool"
      ? { theme: TOOL_THEMES[pillar ?? "mental"] }
      : FILTER_GROUPS[kind];
  const include: Record<string, string[]> = {};
  for (const [group, values] of Object.entries(groups)) {
    if (group === "allergen") continue;
    const chosen = listParam(params[group]).filter((value) =>
      values.includes(value),
    );
    if (chosen.length > 0) include[group] = chosen;
  }
  const without =
    kind === "recipe"
      ? listParam(params.sans).filter((value) =>
          (ALLERGENS as readonly string[]).includes(value),
        )
      : [];
  const q = (Array.isArray(params.q) ? params.q[0] : params.q) ?? "";
  return { include, without, q: q.trim().slice(0, 80) };
}

/** Un élément correspond-il aux filtres ? (au moins une valeur par famille, aucun allergène exclu) */
export function matchesFilters(
  tags: readonly string[],
  filters: LibraryFilters,
) {
  const set = new Set(tags);
  return (
    Object.entries(filters.include).every(([group, values]) =>
      values.some((value) => set.has(tagOf(group, value))),
    ) && filters.without.every((value) => !set.has(tagOf("allergen", value)))
  );
}

// --- Contenu ----------------------------------------------------------------

export const LIBRARY_LIMITS = {
  title: 120,
  summary: 280,
  description: 2000,
  listItems: 20,
  listItem: 300,
  minutes: 600,
  servings: 24,
} as const;

const text = (max: number) => z.string().trim().max(max);
const list = z
  .array(text(LIBRARY_LIMITS.listItem).min(1))
  .max(LIBRARY_LIMITS.listItems);

/** Contenu d'un élément dans une langue. */
export const libraryContentSchema = z.object({
  title: text(LIBRARY_LIMITS.title).min(2),
  summary: text(LIBRARY_LIMITS.summary),
  description: text(LIBRARY_LIMITS.description),
  /** Étapes : comment faire l'exercice, la recette ou l'outil. */
  steps: list,
  /** Exercice : consignes de forme. */
  cues: list.default([]),
  /** Exercice : erreurs fréquentes. */
  mistakes: list.default([]),
  /** Recette : ingrédients, avec leurs quantités. */
  ingredients: list.default([]),
});
export type LibraryContent = z.infer<typeof libraryContentSchema>;

/** Le français fait foi ; l'anglais est facultatif (le français s'affiche à sa place). */
export const localizedContentSchema = z.object({
  fr: libraryContentSchema,
  en: libraryContentSchema.nullable().default(null),
});
export type LocalizedContent = z.infer<typeof localizedContentSchema>;

/** Contenu dans la langue de la page, sinon en français. */
export const contentIn = (content: LocalizedContent, locale: string) =>
  (locale === "en" ? content.en : null) ?? content.fr;

/** Élément du catalogue tel qu'enregistré par l'équipe (formulaire admin ou contenu de départ). */
export const libraryItemSchema = z
  .object({
    kind: z.enum(LIBRARY_KINDS),
    /** Outils seulement : mental ou social. */
    pillar: z.enum(TOOL_PILLARS).nullable().default(null),
    content: localizedContentSchema,
    tags: z.array(z.string()).max(40),
    /** Durée (exercice, outil) ou temps de préparation (recette), en minutes. */
    minutes: z.number().int().min(1).max(LIBRARY_LIMITS.minutes).nullable(),
    /** Recette : portions. */
    servings: z
      .number()
      .int()
      .min(1)
      .max(LIBRARY_LIMITS.servings)
      .nullable()
      .default(null),
  })
  .superRefine((item, context) => {
    if (item.kind === "tool" && !item.pillar) {
      context.addIssue({ code: "custom", path: ["pillar"], message: "pillar" });
    }
    const allowed = allowedTags(item.kind, item.pillar ?? undefined);
    if (item.tags.some((tag) => !allowed.has(tag))) {
      context.addIssue({ code: "custom", path: ["tags"], message: "tags" });
    }
  });
export type LibraryItemInput = z.infer<typeof libraryItemSchema>;

/** Pilier enregistré d'un élément : physique pour les exercices et recettes. */
export const pillarOf = (
  kind: LibraryKind,
  pillar: ToolPillar | null,
): LibraryPillar => (kind === "tool" ? (pillar ?? "mental") : "physical");
