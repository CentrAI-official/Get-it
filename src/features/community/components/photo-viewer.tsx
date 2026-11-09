"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState, type PointerEvent, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { FeedMedia } from "@/server/community/media";

/** Glissée vers le bas qui ferme la photo (comme une story). */
const DISMISS_PX = 110;
/** Glissée sur le côté qui passe à la photo suivante ou précédente. */
const SWIPE_PX = 60;
/** Mouvement avant de choisir le sens de la glissée. */
const LOCK_PX = 8;

type Drag = { x: number; y: number; axis: "x" | "y" | null; active: boolean };
const REST: Drag = { x: 0, y: 0, axis: null, active: false };

/**
 * Photo d'une publication en plein écran (toujours sombre). Glisser vers le
 * bas ramène au fil, comme les stories (décision du fondateur, 2026-11-08) ;
 * glisser sur le côté change de photo. Les flèches restent pour le clavier.
 */
export function PhotoViewer({
  images,
  index,
  onIndex,
  onClose,
  overlay,
}: {
  images: FeedMedia[];
  /** Photo ouverte, ou null (fermé). */
  index: number | null;
  onIndex: (index: number) => void;
  onClose: () => void;
  /** Ce qui est posé sur la photo (textes de la publication), au même cadre. */
  overlay?: (image: FeedMedia) => ReactNode;
}) {
  const t = useTranslations("Community.media");
  const [drag, setDrag] = useState<Drag>(REST);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const current = index === null ? undefined : images[index];
  const count = images.length;

  const go = (step: number) => onIndex(((index ?? 0) + step + count) % count);

  function down(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    start.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function move(event: PointerEvent<HTMLDivElement>) {
    const origin = start.current;
    if (!origin || origin.id !== event.pointerId) return;
    const x = event.clientX - origin.x;
    const y = event.clientY - origin.y;
    setDrag((before) => {
      const axis =
        before.axis ??
        (Math.abs(x) < LOCK_PX && Math.abs(y) < LOCK_PX
          ? null
          : Math.abs(y) > Math.abs(x)
            ? "y"
            : "x");
      return {
        axis,
        active: true,
        // Seulement vers le bas ; une seule photo ne glisse pas sur le côté
        x: axis === "x" && count > 1 ? x : 0,
        y: axis === "y" ? Math.max(0, y) : 0,
      };
    });
  }
  function up(event: PointerEvent<HTMLDivElement>) {
    const origin = start.current;
    if (!origin || origin.id !== event.pointerId) return;
    start.current = null;
    const done = drag;
    setDrag(REST);
    if (done.axis === "y" && done.y >= DISMISS_PX) onClose();
    else if (done.axis === "x" && done.x <= -SWIPE_PX) go(1);
    else if (done.axis === "x" && done.x >= SWIPE_PX) go(-1);
  }

  const fade = 1 - Math.min(drag.y, 400) / 600;

  return (
    <Dialog open={index !== null} onOpenChange={(value) => !value && onClose()}>
      <DialogContent
        closeLabel={t("close")}
        className="dark flex h-[calc(100dvh-2rem)] max-w-[calc(100%-1rem)] flex-col items-center justify-center gap-3 border-0 bg-transparent p-2 sm:max-w-4xl"
      >
        {/* Le fond pâlit à mesure qu'on glisse vers le bas */}
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 rounded-[inherit] bg-black/95"
          style={{ opacity: fade }}
        />
        <DialogTitle className="sr-only">
          {t("open", { index: (index ?? 0) + 1, total: count })}
        </DialogTitle>
        <DialogDescription className="sr-only">{t("viewer")}</DialogDescription>
        <div
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={() => {
            start.current = null;
            setDrag(REST);
          }}
          className="[container-type:size] flex min-h-0 w-full flex-1 touch-none items-center justify-center select-none"
        >
          {current ? (
            <div
              className={cn(
                "[container-type:inline-size] relative",
                !drag.active &&
                  "transition-transform duration-200 motion-reduce:transition-none",
              )}
              style={{
                aspectRatio: `${current.width} / ${current.height}`,
                transform:
                  drag.y > 0
                    ? `translateY(${drag.y}px) scale(${1 - Math.min(drag.y, 400) / 2000})`
                    : `translateX(${drag.x}px)`,
                // Le cadre garde la proportion de la photo et tient dans l'écran
                height: `min(100cqh, calc(100cqw * ${current.height / current.width}))`,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={current.url}
                alt=""
                draggable={false}
                className="size-full object-contain"
              />
              {overlay?.(current)}
            </div>
          ) : null}
        </div>
        {count > 1 ? (
          <div className="flex items-center gap-4" style={{ opacity: fade }}>
            <button
              type="button"
              aria-label={t("previous")}
              onClick={() => go(-1)}
              className="flex size-11 items-center justify-center rounded-full bg-foreground/10 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <ChevronLeft aria-hidden="true" />
            </button>
            <span className="text-sm tabular-nums">
              {(index ?? 0) + 1}/{count}
            </span>
            <button
              type="button"
              aria-label={t("next")}
              onClick={() => go(1)}
              className="flex size-11 items-center justify-center rounded-full bg-foreground/10 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <ChevronRight aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
