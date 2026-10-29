"use client";

import { ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { FeedMedia } from "@/server/community/media";

/** La vidéo en cours de lecture : une seule à la fois dans l'application. */
let playing: HTMLVideoElement | null = null;

/** Part visible sous laquelle une vidéo se met en pause (défilement du fil). */
const MIN_VISIBLE = 0.25;

type FullscreenVideo = HTMLVideoElement & {
  /** Plein écran natif de l'iPhone (hors API Fullscreen). */
  webkitDisplayingFullscreen?: boolean;
};

/**
 * Vidéo d'une publication. Elle ne démarre jamais seule, et se met en pause
 * quand on change de page, quand elle sort de l'écran ou quand une autre
 * vidéo démarre.
 */
/** Secondes regardées avant de compter une vue. */
const VIEW_AFTER_SECONDS = 2;

function PostVideo({
  video,
  className,
  views,
  onViewed,
}: {
  video: FeedMedia;
  className?: string;
  /** Nombre de vues (publications seulement). */
  views?: number;
  onViewed?: () => void;
}) {
  const t = useTranslations("Community.media");
  const format = useFormatter();
  const ref = useRef<HTMLVideoElement>(null);
  const counted = useRef(false);

  // Next garde la page précédente cachée dans le DOM (Activity) au lieu de la
  // retirer : sans ce nettoyage, le son continuerait dans une autre catégorie.
  useLayoutEffect(() => {
    const element: FullscreenVideo | null = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        const fullscreen =
          document.fullscreenElement === element ||
          element.webkitDisplayingFullscreen === true;
        if (entry && entry.intersectionRatio < MIN_VISIBLE && !fullscreen) {
          element.pause();
        }
      },
      { threshold: MIN_VISIBLE },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      element.pause();
      if (playing === element) playing = null;
    };
  }, []);

  function onPlay(event: React.SyntheticEvent<HTMLVideoElement>) {
    const element = event.currentTarget;
    if (playing && playing !== element) playing.pause();
    playing = element;
  }

  const player = (
    <video
      ref={ref}
      src={video.url}
      poster={video.posterUrl ?? undefined}
      controls
      playsInline
      preload="metadata"
      onPlay={onPlay}
      onTimeUpdate={(event) => {
        // Une vue compte après 2 secondes regardées, une seule fois par affichage
        if (
          onViewed &&
          !counted.current &&
          event.currentTarget.currentTime >= VIEW_AFTER_SECONDS
        ) {
          counted.current = true;
          onViewed();
        }
      }}
      className={cn(
        "max-h-[70dvh] w-full rounded-2xl bg-black object-contain",
        className,
      )}
      style={{ aspectRatio: `${video.width} / ${video.height}` }}
    >
      <track kind="captions" />
    </video>
  );
  if (views === undefined) return player;
  return (
    <div className="relative">
      {player}
      <span className="dark pointer-events-none absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold backdrop-blur-sm">
        <Eye aria-hidden="true" className="size-3.5" />
        {t("views", {
          count: views,
          formatted: format.number(views, { notation: "compact" }),
        })}
      </span>
    </div>
  );
}

/** Deux touchers plus rapprochés que ce délai : double-tap (« Bravo »). */
const DOUBLE_TAP_MS = 280;

type PostMediaProps = {
  media: FeedMedia[];
  /** Coins et marges (ex. bord à bord sur téléphone). */
  className?: string;
  /**
   * Double-tap sur une photo. Avec lui, un toucher simple ouvre la photo un
   * court instant plus tard, le temps de reconnaître un deuxième toucher.
   */
  onDoubleTap?: () => void;
  /** Vidéo d'une publication : son nombre de vues, et quand elle est regardée. */
  videoViews?: number;
  onVideoViewed?: () => void;
};

/** Photos (grille, plein écran au toucher) ou vidéo d'une publication. */
export function PostMedia({
  media,
  className,
  onDoubleTap,
  videoViews,
  onVideoViewed,
}: PostMediaProps) {
  const t = useTranslations("Community.media");
  const [open, setOpen] = useState<number | null>(null);
  const lastTap = useRef(0);
  const pendingOpen = useRef<number | null>(null);
  const video = media.find((item) => item.kind === "video");
  const images = media.filter((item) => item.kind === "image");

  // Un toucher en attente ne doit pas ouvrir la photo après avoir quitté la page
  useEffect(
    () => () => {
      if (pendingOpen.current !== null) clearTimeout(pendingOpen.current);
    },
    [],
  );

  /** `at` : moment du toucher (horodatage de l'événement). */
  function tap(index: number, at: number) {
    if (!onDoubleTap) {
      setOpen(index);
      return;
    }
    if (at - lastTap.current < DOUBLE_TAP_MS) {
      if (pendingOpen.current !== null) clearTimeout(pendingOpen.current);
      pendingOpen.current = null;
      lastTap.current = 0;
      onDoubleTap();
      return;
    }
    lastTap.current = at;
    pendingOpen.current = window.setTimeout(() => {
      pendingOpen.current = null;
      setOpen(index);
    }, DOUBLE_TAP_MS);
  }

  if (video) {
    return (
      <PostVideo
        video={video}
        className={className}
        views={videoViews}
        onViewed={onVideoViewed}
      />
    );
  }
  if (images.length === 0) return null;

  const current = open === null ? undefined : images[open];

  return (
    <>
      <ul
        className={cn(
          "grid gap-1 overflow-hidden rounded-2xl",
          images.length === 1 ? "grid-cols-1" : "grid-cols-2",
          className,
        )}
      >
        {images.map((image, index) => (
          <li
            key={image.url}
            className={cn(images.length === 3 && index === 0 && "row-span-2")}
          >
            <button
              type="button"
              onClick={(event) => tap(index, event.timeStamp)}
              aria-label={t("open", { index: index + 1, total: images.length })}
              className="block size-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.url}
                alt=""
                loading="lazy"
                width={image.width}
                height={image.height}
                className={cn(
                  "size-full bg-foreground/5 object-cover",
                  images.length === 1
                    ? "max-h-[70dvh] object-contain"
                    : "aspect-square",
                  images.length === 3 && index === 0 && "aspect-auto h-full",
                )}
              />
            </button>
          </li>
        ))}
      </ul>

      <Dialog
        open={open !== null}
        onOpenChange={(value) => !value && setOpen(null)}
      >
        <DialogContent
          closeLabel={t("close")}
          className="dark flex h-[calc(100dvh-2rem)] max-w-[calc(100%-1rem)] flex-col items-center justify-center gap-3 border-0 bg-black/95 p-2 sm:max-w-4xl"
        >
          <DialogTitle className="sr-only">
            {t("open", { index: (open ?? 0) + 1, total: images.length })}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t("viewer")}
          </DialogDescription>
          {current ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={current.url}
              alt=""
              className="max-h-full max-w-full flex-1 object-contain"
            />
          ) : null}
          {images.length > 1 ? (
            <div className="flex items-center gap-4">
              <button
                type="button"
                aria-label={t("previous")}
                onClick={() =>
                  setOpen((index) =>
                    index === null
                      ? 0
                      : (index - 1 + images.length) % images.length,
                  )
                }
                className="flex size-11 items-center justify-center rounded-full bg-foreground/10 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <ChevronLeft aria-hidden="true" />
              </button>
              <span className="text-sm tabular-nums">
                {(open ?? 0) + 1}/{images.length}
              </span>
              <button
                type="button"
                aria-label={t("next")}
                onClick={() =>
                  setOpen((index) =>
                    index === null ? 0 : (index + 1) % images.length,
                  )
                }
                className="flex size-11 items-center justify-center rounded-full bg-foreground/10 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <ChevronRight aria-hidden="true" />
              </button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
