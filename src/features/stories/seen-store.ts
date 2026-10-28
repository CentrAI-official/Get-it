import { useSyncExternalStore } from "react";

// Stories déjà vues : une commodité propre à cet appareil (stockage du
// navigateur, jamais montré à l'auteur). Sans stockage, tout reste « nouveau ».

const KEY = "getit:stories-seen";
/** Identifiants gardés au plus : les plus anciens sont oubliés. */
const MAX_SEEN = 300;

const EMPTY: ReadonlySet<string> = new Set();
const listeners = new Set<() => void>();
let cache: ReadonlySet<string> | null = null;

function read(): ReadonlySet<string> {
  if (cache) return cache;
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    cache = new Set(
      Array.isArray(parsed)
        ? parsed.filter((id): id is string => typeof id === "string")
        : [],
    );
  } catch {
    cache = new Set();
  }
  return cache;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Marque une story comme vue. */
export function markStorySeen(postId: string) {
  const seen = read();
  if (seen.has(postId)) return;
  const next = [...seen, postId].slice(-MAX_SEEN);
  cache = new Set(next);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Stockage plein ou bloqué : l'état vu reste en mémoire pour cette visite
  }
  for (const listener of listeners) listener();
}

export function useSeenStories(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}
