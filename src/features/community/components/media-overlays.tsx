"use client";

import { OverlayLayer } from "@/features/stories/components/story-overlays";
import type { FeedMedia } from "@/server/community/media";

// Les textes ne dépendent ni de la date ni de la musique d'une story
const CONTEXT = { createdAt: new Date(0), music: null };

/**
 * Textes et emoji posés sur un média de publication, au même endroit que dans
 * l'éditeur : positions en part du média, tailles en part de sa largeur.
 * `fill` : le cadre a déjà la proportion du média. `cover` : le média est
 * rogné pour remplir une case (grille de photos) ; la couche suit ce rognage.
 */
export function MediaOverlays({
  media,
  fit,
}: {
  media: FeedMedia;
  fit: "fill" | "cover";
}) {
  const overlays = media.overlays ?? [];
  if (overlays.length === 0) return null;
  const layer = <OverlayLayer overlays={overlays} context={CONTEXT} />;
  if (fit === "fill") {
    return (
      <div className="[container-type:inline-size] pointer-events-none absolute inset-0">
        {layer}
      </div>
    );
  }
  return (
    <div className="[container-type:size] pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="[container-type:inline-size] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{
          aspectRatio: `${media.width} / ${media.height}`,
          width: `max(100cqw, calc(100cqh * ${media.width / media.height}))`,
        }}
      >
        {layer}
      </div>
    </div>
  );
}

/** Le média a-t-il des textes posés dessus ? */
export const hasOverlays = (media: FeedMedia) =>
  (media.overlays?.length ?? 0) > 0;
