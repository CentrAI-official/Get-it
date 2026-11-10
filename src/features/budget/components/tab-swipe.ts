// Les onglets du budget et le geste qui passe de l'un à l'autre (décision du
// fondateur, 2026-11-10 : « la barre bouge avec ton doigt »). La page publie où
// en est le doigt, de -1 (vers l'onglet d'avant) à 1 (vers le suivant) ; la
// rangée d'onglets y fait suivre son trait orange.

export const BUDGET_TABS = {
  month: "/services/financial/budget",
  transactions: "/services/financial/budget/transactions",
  bills: "/services/financial/budget/bills",
  accounts: "/services/financial/budget/accounts",
  goals: "/services/financial/budget/goals",
  reports: "/services/financial/budget/reports",
} as const;

export type BudgetTabKey = keyof typeof BUDGET_TABS;

export const BUDGET_TAB_KEYS = Object.keys(BUDGET_TABS) as BudgetTabKey[];

/** L'onglet voisin : 1 pour le suivant, -1 pour celui d'avant. */
export function neighborTab(current: BudgetTabKey, direction: 1 | -1) {
  return BUDGET_TAB_KEYS[BUDGET_TAB_KEYS.indexOf(current) + direction] ?? null;
}

type Listener = (progress: number, animate: boolean) => void;
const listeners = new Set<Listener>();

/** Où en est le doigt entre l'onglet ouvert et son voisin. */
export const tabSwipe = {
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  publish(progress: number, animate: boolean) {
    for (const listener of listeners) listener(progress, animate);
  },
};

/**
 * Ce qui passe d'une page à l'autre : chaque onglet est sa propre page. Le trait
 * repart d'où il était, et le contenu arrive du côté du geste.
 */
export const tabMemory: {
  bar: { left: number; width: number } | null;
  enter: "left" | "right" | null;
  scrollLeft: number;
} = { bar: null, enter: null, scrollLeft: 0 };
