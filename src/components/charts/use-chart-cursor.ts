"use client";

import { useState, type KeyboardEvent } from "react";

/**
 * Curseur d'un petit graphique : la colonne survolée, ou parcourue au clavier
 * (flèches, Début, Fin) une fois le graphique sélectionné avec Tab.
 */
export function useChartCursor(count: number) {
  const [active, setActive] = useState<number | null>(null);

  function onKeyDown(event: KeyboardEvent) {
    const last = count - 1;
    const current = active ?? last;
    const next =
      event.key === "ArrowLeft"
        ? Math.max(0, current - 1)
        : event.key === "ArrowRight"
          ? Math.min(last, current + 1)
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : null;
    if (next === null) return;
    event.preventDefault();
    setActive(next);
  }

  return {
    active,
    /** À placer sur le conteneur focalisable du graphique. */
    containerProps: {
      tabIndex: 0,
      onKeyDown,
      // Au clavier, le parcours commence par le jour le plus récent
      onFocus: () => setActive((value) => value ?? count - 1),
      onBlur: () => setActive(null),
      onPointerLeave: () => setActive(null),
    },
    /** À placer sur chaque colonne (zone de survol pleine hauteur). */
    slotProps: (index: number) => ({
      onPointerEnter: () => setActive(index),
    }),
  };
}
