import { useSyncExternalStore } from "react";
import type { Progress } from "./day-plan";

// État partagé de « Ma journée » : le popup vit dans la mise en page de
// l'application, ses boutons d'ouverture dans la barre latérale, la barre du
// haut et le menu « + ».

type DayPanelState = {
  open: boolean;
  /** À l'ouverture, placer le curseur dans l'ajout de tâche (menu « + »). */
  focusNewTask: boolean;
  /** Avancement du jour, affiché sur les boutons ; null tant qu'il n'est pas chargé. */
  progress: Progress | null;
};

const SERVER_STATE: DayPanelState = {
  open: false,
  focusNewTask: false,
  progress: null,
};

let state = SERVER_STATE;
const listeners = new Set<() => void>();

function update(next: Partial<DayPanelState>) {
  state = { ...state, ...next };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useDayPanel() {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => SERVER_STATE,
  );
}

export function openDayPanel(options?: { focusNewTask?: boolean }) {
  update({ open: true, focusNewTask: options?.focusNewTask ?? false });
}

export function closeDayPanel() {
  update({ open: false, focusNewTask: false });
}

export function setDayProgress(progress: Progress) {
  if (
    state.progress?.done === progress.done &&
    state.progress.total === progress.total
  ) {
    return;
  }
  update({ progress });
}
