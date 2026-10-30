"use client";

import {
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

/** Largeur des actions révélées : deux boutons de 72 px. */
const ACTIONS_WIDTH = 144;
/** Déplacement minimal avant de décider entre glisser et faire défiler. */
const SLOP = 8;

type SwipeRowProps = {
  /** Boutons révélés derrière la ligne, à gauche (deux au plus). */
  actions: ReactNode;
  children: ReactNode;
  className?: string;
};

type Gesture = {
  x: number;
  y: number;
  base: number;
  axis: "x" | "y" | null;
};

/**
 * Ligne qu'on glisse vers la droite pour faire sortir « Modifier » et
 * « Supprimer » de derrière elle (décision du fondateur, 2026-10-29). Au
 * clavier, les actions s'ouvrent dès qu'elles reçoivent le focus.
 */
export function SwipeRow({ actions, children, className }: SwipeRowProps) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  // Un glissement ne doit pas aussi « cliquer » ce qui est sous le doigt
  const swallowClick = useRef(false);
  const open = offset > 0;

  // Toucher ailleurs referme la ligne
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOffset(0);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  function finish() {
    const current = gesture.current;
    gesture.current = null;
    if (current?.axis !== "x") return;
    swallowClick.current = true;
    setDragging(false);
    setOffset((value) => (value > ACTIONS_WIDTH / 2 ? ACTIONS_WIDTH : 0));
  }

  return (
    <div
      ref={root}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) setOffset(0);
      }}
      className={cn("relative overflow-hidden rounded-2xl", className)}
    >
      <div
        className="absolute inset-y-0 left-0 flex"
        style={{ width: ACTIONS_WIDTH }}
        onFocus={() => setOffset(ACTIONS_WIDTH)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setOffset(0);
        }}
        // Une action choisie referme la ligne (on la retrouve fermée au retour)
        onClick={() => setOffset(0)}
      >
        {actions}
      </div>
      <div
        style={{ transform: `translateX(${offset}px)` }}
        className={cn(
          "relative touch-pan-y bg-background select-none",
          !dragging && "transition-transform duration-200 ease-out",
          open && "shadow-[-12px_0_20px_rgba(0,0,0,0.3)]",
        )}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          // Au doigt, aucun clic ne suit un glissement : on repart de zéro
          swallowClick.current = false;
          gesture.current = {
            x: event.clientX,
            y: event.clientY,
            base: offset,
            axis: null,
          };
        }}
        onPointerMove={(event) => {
          const current = gesture.current;
          if (!current) return;
          const dx = event.clientX - current.x;
          const dy = event.clientY - current.y;
          if (current.axis === null) {
            if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return;
            current.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
            if (current.axis === "x") {
              event.currentTarget.setPointerCapture(event.pointerId);
              setDragging(true);
            }
          }
          if (current.axis !== "x") return;
          setOffset(Math.min(ACTIONS_WIDTH, Math.max(0, current.base + dx)));
        }}
        onPointerUp={finish}
        onPointerCancel={finish}
        onClickCapture={(event) => {
          // Le clic qui suit un glissement (à la souris) est ignoré ;
          // toucher la ligne ouverte la referme
          if (swallowClick.current) {
            swallowClick.current = false;
          } else if (open) {
            setOffset(0);
          } else {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
        }}
      >
        {children}
      </div>
    </div>
  );
}

const ACTION =
  "flex w-[72px] flex-col items-center justify-center gap-1 text-[11px] font-semibold outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/60 [&_svg]:size-[18px]";

/** Un bouton révélé : « Modifier » (neutre) ou « Supprimer » (rouge). */
export function SwipeAction({
  tone = "neutral",
  className,
  ...props
}: ComponentProps<"button"> & { tone?: "neutral" | "danger" }) {
  return (
    <button
      type="button"
      className={cn(
        ACTION,
        tone === "danger"
          ? "bg-destructive text-white"
          : "bg-accent text-foreground",
        className,
      )}
      {...props}
    />
  );
}

/** Classes d'une action en lien (ex. « Modifier » qui ouvre une page). */
export const swipeActionClass = cn(ACTION, "bg-accent text-foreground");
