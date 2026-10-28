import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Anneau orange rempli selon la part faite (0 à 1), en partant du haut. */
export function ringBackground(part: number) {
  const end = Math.round(Math.min(1, Math.max(0, part)) * 100);
  return `conic-gradient(var(--primary) 0 ${end}%, color-mix(in oklab, var(--foreground) 12%, transparent) ${end}% 100%)`;
}

type ProgressRingProps = {
  /** Part faite, de 0 à 1. */
  value: number;
  /** Taille et épaisseur (ex. « size-14 p-[3px] »). */
  className?: string;
  /** Contenu du centre (icône, pourcentage). */
  children?: ReactNode;
  style?: CSSProperties;
};

/**
 * Anneau de progression façon orbite : sphère sombre au centre. Décoratif :
 * l'avancement doit aussi être donné en texte (ex. « 2 sur 3 jalons »).
 */
export function ProgressRing({
  value,
  className,
  children,
  style,
}: ProgressRingProps) {
  return (
    <span
      aria-hidden="true"
      className={cn("flex shrink-0 rounded-full p-[3px]", className)}
      style={{ background: ringBackground(value), ...style }}
    >
      <span className="flex size-full items-center justify-center rounded-full orb">
        {children}
      </span>
    </span>
  );
}
