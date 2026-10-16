import { useSyncExternalStore } from "react";
import type { Progress } from "./day-plan";

// État partagé de « Ma journée » : le popup vit dans la mise en page de
// l'application, son bouton d'ouverture dans le Profil.

type DayPanelState = {
  open: boolean;
  /** Avancement du jour, affiché sur le bouton ; null tant qu'il n'est pas chargé. */
  progress: Progress | null;
};

const SERVER_STATE: DayPanelState = { open: false, progress: null };

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

export function openDayPanel() {
  update({ open: true });
}

export function closeDayPanel() {
  update({ open: false });
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
