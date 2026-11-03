"use client";

import { useEffect } from "react";
import { syncWorkoutAction } from "../actions";
import { syncPayload } from "../draft";
import { listDrafts, removeDraft } from "../store";

/**
 * À l'ouverture du plan, et quand le réseau revient : envoie ce que le téléphone
 * a gardé d'une séance terminée, ou d'un jour passé (la personne a oublié de
 * toucher « Terminer »). La séance du jour en cours reste à reprendre.
 */
export function useDraftFlush(
  owner: string | null,
  today: string,
  onChanged: () => void,
) {
  useEffect(() => {
    if (!owner) return;
    let running = false;
    async function flush() {
      if (running || !owner) return;
      running = true;
      let changed = false;
      for (const draft of listDrafts(owner, today)) {
        const old = draft.day < today;
        if (!old && !draft.finish) continue;
        const { day, weekday } = draft;
        if (!draft.finish && !draft.sets.some((set) => set.done)) {
          removeDraft(owner, day, weekday);
          continue;
        }
        try {
          const result = await syncWorkoutAction({
            ...syncPayload(draft),
            finish: draft.finish ?? {
              finishedAt: draft.touchedAt ?? draft.startedAt,
              feeling: null,
            },
          });
          // Reçu, ou refusé pour de bon : réessayer n'y changerait rien
          removeDraft(owner, day, weekday);
          if (result.ok) changed = true;
        } catch {
          // Toujours pas de réseau : le brouillon attend
          break;
        }
      }
      running = false;
      if (changed) onChanged();
    }
    void flush();
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
  }, [owner, today, onChanged]);
}
