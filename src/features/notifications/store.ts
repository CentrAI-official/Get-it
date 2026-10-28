import { useSyncExternalStore } from "react";

// Notifications non lues, affichées sur la cloche. Un seul rafraîchissement
// pour toute l'application (NotificationPoller, dans la mise en page).

let count = 0;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useNotificationCount() {
  return useSyncExternalStore(
    subscribe,
    () => count,
    () => 0,
  );
}

export function setNotificationCount(next: number) {
  if (next === count) return;
  count = next;
  for (const listener of listeners) listener();
}
