"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { useRouter } from "@/i18n/navigation";
import {
  BUDGET_TABS,
  neighborTab,
  tabMemory,
  tabSwipe,
  type BudgetTabKey,
} from "./tab-swipe";

/** Déplacement avant de choisir entre glisser et faire défiler. */
const SLOP = 10;
/** Part de la largeur à glisser pour changer d'onglet (ou un geste rapide). */
const THRESHOLD = 0.25;

/**
 * Glisser le contenu du budget vers la gauche ou la droite passe à l'onglet
 * suivant ou à celui d'avant, comme les onglets d'Instagram (décision du
 * fondateur, 2026-11-10) ; le trait orange des onglets suit le doigt. Les zones
 * qui glissent déjà (rangées qu'on fait défiler, lignes à glisser, curseurs,
 * champs, graphiques) gardent leur geste.
 */
export function BudgetSwipe({
  current,
  children,
}: {
  current: BudgetTabKey;
  children: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    // Une page quittée en glissant puis revue (Next la garde cachée) : remise en place
    element.style.transition = "none";
    element.style.transform = "";
    element.style.opacity = "";
    // Arrivée par un glissement : le contenu entre du côté du geste
    if (tabMemory.enter && !reduce) {
      element.animate(
        [
          {
            transform: `translateX(${tabMemory.enter === "right" ? 24 : -24}%)`,
            opacity: 0,
          },
          { transform: "translateX(0)", opacity: 1 },
        ],
        { duration: 220, easing: "cubic-bezier(0.2, 0.7, 0.2, 1)" },
      );
    }
    tabMemory.enter = null;

    let start: { x: number; y: number; time: number } | null = null;
    let axis: "x" | "y" | null = null;
    let dx = 0;
    // Une ligne à glisser (fermée) garde seulement le geste vers la droite
    let rightOnly = false;
    const width = () => element.clientWidth || window.innerWidth;

    /** Ce qui garde son propre geste horizontal : tout, vers la droite seulement, ou rien. */
    const keepsGesture = (
      target: EventTarget | null,
    ): "all" | "right" | null => {
      let node = target instanceof Element ? target : null;
      while (node && node !== element) {
        if (
          node.matches(
            "input, textarea, select, [role=slider], .recharts-wrapper",
          )
        ) {
          return "all";
        }
        const own = node.getAttribute("data-no-page-swipe");
        if (own !== null) return own === "right" ? "right" : "all";
        const overflow = getComputedStyle(node).overflowX;
        if (
          (overflow === "auto" || overflow === "scroll") &&
          node.scrollWidth > node.clientWidth + 1
        ) {
          return "all";
        }
        node = node.parentElement;
      }
      return null;
    };

    const onStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      const kept = keepsGesture(event.target);
      if (event.touches.length !== 1 || !touch || kept === "all") {
        start = null;
        return;
      }
      rightOnly = kept === "right";
      start = { x: touch.clientX, y: touch.clientY, time: event.timeStamp };
      axis = null;
      dx = 0;
    };

    const onMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!start || !touch) return;
      const x = touch.clientX - start.x;
      const y = touch.clientY - start.y;
      if (!axis) {
        if (Math.abs(x) < SLOP && Math.abs(y) < SLOP) return;
        axis = Math.abs(x) > Math.abs(y) * 1.2 ? "x" : "y";
        // Vers la droite sur une ligne à glisser : c'est la ligne qui s'ouvre
        if (axis === "x" && rightOnly && x > 0) {
          start = null;
          return;
        }
      }
      if (axis !== "x") return;
      if (event.cancelable) event.preventDefault();
      const direction = x < 0 ? 1 : -1;
      const open = neighborTab(current, direction) !== null;
      // Au bout de la rangée, le contenu résiste
      dx = open ? x : x * 0.2;
      element.style.transition = "none";
      if (!reduce) element.style.transform = `translateX(${dx * 0.5}px)`;
      tabSwipe.publish(
        open ? Math.max(-1, Math.min(1, -x / width())) : 0,
        false,
      );
    };

    const onEnd = (event: TouchEvent) => {
      if (!start || axis !== "x") {
        start = null;
        return;
      }
      const elapsed = Math.max(1, event.timeStamp - start.time);
      start = null;
      const direction = dx < 0 ? 1 : -1;
      const next = neighborTab(current, direction);
      const fast = Math.abs(dx) > 40 && Math.abs(dx) / elapsed > 0.5;
      if (next && (Math.abs(dx) > width() * THRESHOLD || fast)) {
        tabSwipe.publish(direction, true);
        tabMemory.enter = direction > 0 ? "right" : "left";
        if (!reduce) {
          element.style.transition =
            "transform 160ms ease-in, opacity 160ms ease-in";
          element.style.transform = `translateX(${direction > 0 ? -30 : 30}%)`;
          element.style.opacity = "0";
        }
        router.push(BUDGET_TABS[next], { transitionTypes: [] });
      } else {
        tabSwipe.publish(0, true);
        element.style.transition = reduce ? "none" : "transform 200ms ease-out";
        element.style.transform = "";
      }
    };

    element.addEventListener("touchstart", onStart, { passive: true });
    element.addEventListener("touchmove", onMove, { passive: false });
    element.addEventListener("touchend", onEnd);
    element.addEventListener("touchcancel", onEnd);
    return () => {
      element.removeEventListener("touchstart", onStart);
      element.removeEventListener("touchmove", onMove);
      element.removeEventListener("touchend", onEnd);
      element.removeEventListener("touchcancel", onEnd);
    };
  }, [current, router]);

  return (
    <div ref={root} className="touch-pan-y touch-pinch-zoom">
      {children}
    </div>
  );
}
