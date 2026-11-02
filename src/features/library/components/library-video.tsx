"use client";

import { useLayoutEffect, useRef } from "react";

/**
 * Vidéo de démonstration d'un exercice. Next garde les pages quittées cachées
 * dans le DOM : la vidéo se met en pause quand la page disparaît.
 */
export function LibraryVideo({
  src,
  poster,
  label,
}: {
  src: string;
  poster: string | null;
  label: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useLayoutEffect(() => {
    const video = ref.current;
    return () => video?.pause();
  }, []);

  return (
    <video
      ref={ref}
      src={src}
      poster={poster ?? undefined}
      controls
      playsInline
      preload="metadata"
      aria-label={label}
      className="aspect-video w-full rounded-2xl bg-black object-contain"
    />
  );
}
