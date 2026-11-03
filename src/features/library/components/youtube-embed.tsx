"use client";

import { Play } from "lucide-react";
import { useTranslations } from "next-intl";
import { useLayoutEffect, useRef, useState } from "react";
import { youtubeEmbedUrl, type LibraryYoutube } from "../rules";

/**
 * Démonstration YouTube d'une fiche. Rien n'est chargé chez YouTube (Google)
 * avant le toucher sur « Lire » (Loi 25) ; ensuite, le lecteur sans témoins.
 * Next garde les pages quittées cachées dans le DOM : la vidéo se met en pause
 * quand la page disparaît.
 */
export function YoutubeEmbed({
  video,
  channel,
  poster,
  title,
}: {
  video: LibraryYoutube;
  channel: string | null;
  poster: string | null;
  title: string;
}) {
  const t = useTranslations("Library.detail");
  const [playing, setPlaying] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);

  useLayoutEffect(() => {
    const node = frame.current;
    if (!playing || !node) return;
    return () =>
      node.contentWindow?.postMessage(
        JSON.stringify({ event: "command", func: "pauseVideo", args: [] }),
        "https://www.youtube-nocookie.com",
      );
  }, [playing]);

  return (
    <figure className="flex flex-col gap-2">
      {playing ? (
        <iframe
          ref={frame}
          src={youtubeEmbedUrl(video, window.location.origin)}
          title={t("videoLabel", { title })}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="aspect-video w-full rounded-2xl bg-black"
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          className="group relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-2xl bg-foreground/[0.06] outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {poster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={poster}
              alt=""
              className="absolute inset-0 size-full object-cover opacity-70"
            />
          ) : null}
          <span className="relative flex flex-col items-center gap-2 text-sm font-semibold">
            <span className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform group-hover:scale-105">
              <Play aria-hidden="true" className="size-6 translate-x-0.5" />
            </span>
            {t("youtubePlay")}
          </span>
        </button>
      )}
      <figcaption className="text-xs text-muted-foreground">
        {channel ? t("youtubeCredit", { channel }) : t("youtubeCreditUnknown")}{" "}
        {playing ? null : t("youtubePrivacy")}
      </figcaption>
    </figure>
  );
}
