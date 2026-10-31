"use client";

import { RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/** Distance à tirer pour recharger, et distance maximale du rond. */
const TRIGGER_PX = 70;
const MAX_PX = 110;

/**
 * Tirer vers le bas en haut de la page la recharge, comme Instagram : un rond
 * orange descend avec le doigt, tourne pendant le rechargement, puis remonte.
 * Sur téléphone seulement ; pas dans une fenêtre ni dans une zone qui défile.
 */
export function PullToRefresh() {
  const t = useTranslations("App.refresh");
  const router = useRouter();
  const [pull, setPull] = useState(0);
  const [refreshing, startRefresh] = useTransition();
  const start = useRef<number | null>(null);
  const distance = useRef(0);

  useEffect(() => {
    // Le rafraîchissement du navigateur laisse la place à celui-ci
    const root = document.documentElement;
    const before = root.style.overscrollBehaviorY;
    root.style.overscrollBehaviorY = "none";

    function onStart(event: TouchEvent) {
      const touch = event.touches[0];
      if (!touch || event.touches.length > 1 || window.scrollY > 0) return;
      const target = event.target as HTMLElement | null;
      if (
        !target ||
        target.closest(
          "[role=dialog], [role=alertdialog], [role=spinbutton], input, textarea, select, [data-no-pull]",
        )
      ) {
        return;
      }
      // Une zone qui défile et n'est pas en haut : on la laisse défiler
      for (
        let node: HTMLElement | null = target;
        node;
        node = node.parentElement
      ) {
        if (node === document.body) break;
        if (
          /(auto|scroll)/.test(getComputedStyle(node).overflowY) &&
          node.scrollTop > 0
        ) {
          return;
        }
      }
      start.current = touch.clientY;
      distance.current = 0;
    }

    function onMove(event: TouchEvent) {
      const touch = event.touches[0];
      if (start.current === null || !touch) return;
      const dy = touch.clientY - start.current;
      // Résistance : le rond descend moins vite que le doigt
      distance.current = dy > 0 ? Math.min(MAX_PX, dy * 0.5) : 0;
      setPull(distance.current);
    }

    function onEnd() {
      if (start.current === null) return;
      start.current = null;
      if (distance.current >= TRIGGER_PX) {
        startRefresh(async () => {
          router.refresh();
          // Le rond tourne au moins un instant, même si la page répond vite
          await new Promise((resolve) => setTimeout(resolve, 700));
        });
      }
      distance.current = 0;
      setPull(0);
    }

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    return () => {
      root.style.overscrollBehaviorY = before;
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [router]);

  const offset = refreshing ? TRIGGER_PX : pull;
  const ready = pull >= TRIGGER_PX;
  return (
    <div
      aria-hidden={!refreshing}
      className="pointer-events-none fixed inset-x-0 top-16 z-30 flex justify-center lg:hidden"
    >
      <span
        role={refreshing ? "status" : undefined}
        className={cn(
          "flex size-10 items-center justify-center rounded-full border border-foreground/10 bg-raised text-primary shadow-lg",
          offset === 0 && !refreshing && "opacity-0",
          pull === 0 && "transition-[translate,opacity] duration-300",
        )}
        style={{
          translate: `0 ${offset - 48}px`,
          opacity: refreshing ? 1 : Math.min(1, offset / TRIGGER_PX),
        }}
      >
        <RefreshCw
          aria-hidden="true"
          className={cn("size-5", refreshing && "animate-spin")}
          style={refreshing ? undefined : { rotate: `${pull * 3}deg` }}
          strokeWidth={ready || refreshing ? 2.75 : 2}
        />
        {refreshing ? <span className="sr-only">{t("refreshing")}</span> : null}
      </span>
    </div>
  );
}
