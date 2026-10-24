import { isoWeekday, lastDays } from "@/lib/dates";

// Mode « Focus » de Ma journée : une quête à la fois, en plein écran.
// Rien n'est enregistré en plus : « Plus tard » ne vaut que pour cette ouverture.

type FocusQuest = { key: string; done: boolean };

/**
 * Ordre de passage, figé à l'ouverture : les quêtes déjà faites d'abord (les
 * segments se remplissent de gauche à droite), puis les autres, dans l'ordre reçu.
 */
export function focusOrder(quests: readonly FocusQuest[]): string[] {
  return [
    ...quests.filter((quest) => quest.done),
    ...quests.filter((quest) => !quest.done),
  ].map((quest) => quest.key);
}

/**
 * Ordre figé mis à jour : les quêtes supprimées en sortent, celles ajoutées
 * depuis l'ouverture (nouvelle tâche) arrivent à la fin.
 */
export function mergeOrder(
  order: readonly string[],
  keys: readonly string[],
): string[] {
  const present = new Set(keys);
  const kept = order.filter((key) => present.has(key));
  const known = new Set(kept);
  return [...kept, ...keys.filter((key) => !known.has(key))];
}

/**
 * Prochaine quête à montrer : la première encore à faire, et pas gardée pour
 * plus tard, après `from` puis depuis le début. Null : il ne reste rien (récap).
 */
export function nextFocus(
  order: readonly string[],
  done: Readonly<Record<string, boolean>>,
  later: ReadonlySet<string>,
  from: string | null,
): string | null {
  const start = from === null ? 0 : order.indexOf(from) + 1;
  const rotated = [...order.slice(start), ...order.slice(0, start)];
  return rotated.find((key) => !done[key] && !later.has(key)) ?? null;
}

export type SegmentState = "done" | "later" | "current" | "todo";

/** État d'un segment de la barre du haut. */
export function segmentState(
  key: string,
  current: string | null,
  done: Readonly<Record<string, boolean>>,
  later: ReadonlySet<string>,
): SegmentState {
  if (done[key]) return "done";
  if (key === current) return "current";
  if (later.has(key)) return "later";
  return "todo";
}

/** Nombre de jours montrés sous une habitude. */
export const FOCUS_DAYS = 14;

export type FocusDay = { day: string; done: boolean; planned: boolean };

/** Les derniers jours d'une habitude, du plus ancien à aujourd'hui. */
export function habitDays(
  completions: ReadonlySet<string>,
  weekdays: readonly number[],
  today: string,
): FocusDay[] {
  return lastDays(today, FOCUS_DAYS).map((day) => ({
    day,
    done: completions.has(day),
    planned: weekdays.includes(isoWeekday(day)),
  }));
}
