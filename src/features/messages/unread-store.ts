import { useSyncExternalStore } from "react";

// Nombre de conversations non lues, affiché sur l'onglet Messagerie. Un seul
// rafraîchissement pour toute l'application (UnreadPoller, dans la mise en page).

let count = 0;
const listeners = new Set<() => void>();
/** Demande de rafraîchissement immédiat (après une lecture). */
const refreshers = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useUnreadCount() {
  return useSyncExternalStore(
    subscribe,
    () => count,
    () => 0,
  );
}

export function setUnreadCount(next: number) {
  if (next === count) return;
  count = next;
  for (const listener of listeners) listener();
}

export function onUnreadRefresh(refresh: () => void) {
  refreshers.add(refresh);
  return () => {
    refreshers.delete(refresh);
  };
}

/** Une conversation vient d'être lue ou a changé : la pastille se met à jour. */
export function refreshUnreadCount() {
  for (const refresh of refreshers) refresh();
}
