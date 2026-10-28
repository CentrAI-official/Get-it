import type { ReactNode } from "react";
import type { Pillar } from "@/config/pillars";

// Géométrie de la maquette (322 × 300), en pourcentages : l'orbite suit la largeur disponible
const BOX = { width: 322, height: 300 };
const CENTER = { x: 161, y: 150 };
const RADIUS = 112;
/** Position de chaque bulle sur l'orbite, en degrés (0 à droite, sens horaire). */
const ANGLES: Record<Pillar, number> = {
  physical: -135,
  mental: -45,
  financial: 45,
  social: 135,
};

const toX = (px: number) => `${(px / BOX.width) * 100}%`;
const toY = (px: number) => `${(px / BOX.height) * 100}%`;

/** Largeur, en pourcentage du cadre, d'un élément de `px` pixels de la maquette. */
export const orbitWidth = toX;

/** Centre de la bulle d'un pilier sur l'orbite. */
export function orbitPosition(pillar: Pillar) {
  const angle = (ANGLES[pillar] * Math.PI) / 180;
  return {
    left: toX(CENTER.x + RADIUS * Math.cos(angle)),
    top: toY(CENTER.y + RADIUS * Math.sin(angle)),
  };
}

/**
 * Cadre des orbites (« Ton système », « Ta progression ») : les cercles et le
 * satellite qui tourne. Le centre et les bulles sont placés par-dessus.
 */
export function OrbitFrame({ children }: { children: ReactNode }) {
  return (
    <div className="@container relative mx-auto aspect-[322/300] w-full max-w-[380px]">
      <svg
        viewBox={`0 0 ${BOX.width} ${BOX.height}`}
        aria-hidden="true"
        className="absolute inset-0 size-full"
      >
        <circle
          cx={CENTER.x}
          cy={CENTER.y}
          r={RADIUS}
          fill="none"
          className="stroke-foreground/10"
          strokeDasharray="3 6"
        />
        <circle
          cx={CENTER.x}
          cy={CENTER.y}
          r={70}
          fill="none"
          className="stroke-primary/20"
        />
      </svg>

      {/* Satellite qui fait le tour de l'orbite */}
      <div
        aria-hidden="true"
        className="absolute motion-safe:animate-orbit"
        style={{
          left: toX(CENTER.x - RADIUS),
          top: toY(CENTER.y - RADIUS),
          width: toX(RADIUS * 2),
          height: toY(RADIUS * 2),
        }}
      >
        <span className="absolute top-0 left-1/2 size-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_10px_var(--primary)]" />
      </div>

      {children}
    </div>
  );
}
