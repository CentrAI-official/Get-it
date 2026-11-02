import type { LibraryKind, LibraryPillar } from "@/features/library/rules";
import type { DevelopmentPlan, PlanItem } from "./plan";
import type { Answers, DevelopmentKind } from "./questionnaires";

// Plans bâtis à partir du catalogue Get iT (décision du fondateur, 2026-11-01) :
// Get iT AI reçoit les éléments publiés qui conviennent, chacun avec un code
// court (« E3 »), et le reprend dans `ref` ; le serveur le retraduit en
// identifiant. Fonctions pures, testées dans development.test.ts.

/** Le catalogue de chaque plan (le financier n'en a pas). */
export const PLAN_LIBRARY: Partial<
  Record<DevelopmentKind, { kind: LibraryKind; pillar: LibraryPillar }>
> = {
  physical: { kind: "exercise", pillar: "physical" },
  nutrition: { kind: "recipe", pillar: "physical" },
  mental: { kind: "tool", pillar: "mental" },
  social: { kind: "tool", pillar: "social" },
};

/** Le plan qui reçoit un élément du catalogue (« Ajouter à mon plan »). */
export function planKindOf(
  kind: LibraryKind,
  pillar: LibraryPillar,
): DevelopmentKind {
  if (kind === "exercise") return "physical";
  if (kind === "recipe") return "nutrition";
  return pillar === "social" ? "social" : "mental";
}

const PREFIX: Record<LibraryKind, string> = {
  exercise: "E",
  recipe: "R",
  tool: "T",
};

/** Éléments envoyés au plus (la demande reste courte). */
export const CATALOGUE_LIMIT = 80;

export type CatalogueEntry = {
  id: string;
  title: string;
  tags: string[];
  minutes: number | null;
};

const answerList = (value: Answers[string] | undefined) =>
  Array.isArray(value) ? value : [];

/**
 * Une recette convient-elle aux réponses ? Jamais un allergène déclaré ;
 * végane : seulement végane ; végétarien : végétarien ou végane ; pescétarien :
 * végétarien, végane, ou avec du poisson ou des fruits de mer.
 */
export function recipeAllowed(tags: readonly string[], answers: Answers) {
  const set = new Set(tags);
  if (answerList(answers.allergies).some((a) => set.has(`allergen:${a}`))) {
    return false;
  }
  const veggie = set.has("diet:vegetarian") || set.has("diet:vegan");
  switch (answers.diet) {
    case "vegan":
      return set.has("diet:vegan");
    case "vegetarian":
      return veggie;
    case "pescatarian":
      return (
        veggie || set.has("allergen:fish") || set.has("allergen:shellfish")
      );
    default:
      return true;
  }
}

/**
 * Le catalogue d'un plan pour la demande : une ligne par élément (code, titre,
 * étiquettes, durée) et la table des codes vers les identifiants.
 */
export function catalogueFor(
  kind: LibraryKind,
  entries: readonly CatalogueEntry[],
): { text: string; codes: Map<string, string> } {
  const codes = new Map<string, string>();
  const lines = entries.slice(0, CATALOGUE_LIMIT).map((entry, index) => {
    const code = `${PREFIX[kind]}${index + 1}`;
    codes.set(code, entry.id);
    const tags = entry.tags.join(", ");
    const minutes = entry.minutes ? `, ${entry.minutes} min` : "";
    return `${code}: ${JSON.stringify(entry.title)} [${tags}${minutes}]`;
  });
  return { text: lines.join("\n"), codes };
}

const mapItems = (
  plan: DevelopmentPlan,
  map: (item: PlanItem) => PlanItem,
): DevelopmentPlan => ({
  ...plan,
  schedule: plan.schedule.map((day) => ({
    ...day,
    items: day.items.map(map),
  })),
});

/** Codes du modèle → identifiants ; un code inconnu redevient un élément écrit à la main. */
export function resolvePlanRefs(
  plan: DevelopmentPlan,
  codes: ReadonlyMap<string, string>,
): DevelopmentPlan {
  return mapItems(plan, (item) => ({
    ...item,
    ref: item.ref ? (codes.get(item.ref.toUpperCase()) ?? null) : null,
  }));
}

/** Identifiants → codes, pour envoyer un plan existant à modifier. */
export function refsToCodes(
  plan: DevelopmentPlan,
  codes: ReadonlyMap<string, string>,
): DevelopmentPlan {
  const byId = new Map([...codes].map(([code, id]) => [id, code]));
  return mapItems(plan, (item) => ({
    ...item,
    ref: item.ref ? (byId.get(item.ref) ?? null) : null,
  }));
}
