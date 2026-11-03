import { useSyncExternalStore } from "react";
import { addDays } from "@/lib/dates";
import { workoutDraftSchema, type WorkoutDraft } from "./draft";
import { WORKOUT_DAYS_BACK } from "./rules";

// Les brouillons de séance gardés sur ce téléphone, un par compte : le carnet
// continue de marcher sans réseau. Le stockage peut être vide ou bloqué
// (navigation privée) : tout passe par try/catch, et le serveur reste la référence.

const PREFIX = "getit:workout:";

const keyOf = (owner: string, day: string, weekday: number) =>
  `${PREFIX}${owner}:${day}:${weekday}`;

const listeners = new Set<() => void>();
const emit = () => {
  for (const listener of listeners) listener();
};

function read(key: string): WorkoutDraft | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = workoutDraftSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function loadDraft(owner: string, day: string, weekday: number) {
  return read(keyOf(owner, day, weekday));
}

export function saveDraft(owner: string, draft: WorkoutDraft) {
  try {
    window.localStorage.setItem(
      keyOf(owner, draft.day, draft.weekday),
      JSON.stringify({ ...draft, touchedAt: new Date().toISOString() }),
    );
  } catch {
    // Stockage plein ou bloqué : le serveur garde ce qui lui a été envoyé
  }
  emit();
}

export function removeDraft(owner: string, day: string, weekday: number) {
  try {
    window.localStorage.removeItem(keyOf(owner, day, weekday));
  } catch {
    // Rien à faire
  }
  emit();
}

const ownerKeys = (owner: string) => {
  const prefix = `${PREFIX}${owner}:`;
  return Array.from({ length: window.localStorage.length }, (_, index) =>
    window.localStorage.key(index),
  ).filter((key): key is string => key?.startsWith(prefix) ?? false);
};

/** Les brouillons de ce compte ; ceux trop vieux pour être envoyés sont effacés. */
export function listDrafts(owner: string, today: string): WorkoutDraft[] {
  const drafts: WorkoutDraft[] = [];
  try {
    const oldest = addDays(today, -WORKOUT_DAYS_BACK);
    for (const key of ownerKeys(owner)) {
      const draft = read(key);
      if (!draft || draft.day < oldest) window.localStorage.removeItem(key);
      else drafts.push(draft);
    }
  } catch {
    // Rien à lire
  }
  return drafts;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Les séances qui ont un brouillon sur ce téléphone (« jour:jour de la semaine »). */
export function useDraftSessions(owner: string): string {
  return useSyncExternalStore(
    subscribe,
    () => {
      try {
        const start = `${PREFIX}${owner}:`.length;
        return ownerKeys(owner)
          .map((key) => key.slice(start))
          .sort()
          .join(",");
      } catch {
        return "";
      }
    },
    () => "",
  );
}
