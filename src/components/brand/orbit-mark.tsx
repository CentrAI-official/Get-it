import { ringBackground } from "@/components/progress-ring";
import { PILLARS, pillarIcons, type Pillar } from "@/config/pillars";
import { cn } from "@/lib/utils";

/** Même disposition que l'orbite de la page Aujourd'hui (degrés, 0 à droite). */
const ANGLES: Record<Pillar, number> = {
  physical: -135,
  mental: -45,
  financial: 45,
  social: 135,
};
/** Rayon de l'orbite, en % de la largeur. */
const RADIUS = 38;

/** Orbite décorative des quatre piliers, signature visuelle de Get iT. */
export function OrbitMark({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("relative aspect-square", className)}>
      <div className="absolute inset-[12%] rounded-full border border-dashed border-foreground/10" />
      <div className="absolute inset-[30%] rounded-full border border-primary/20" />
      <div className="absolute inset-[12%] motion-safe:animate-orbit">
        <span className="absolute top-0 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_12px_var(--primary)]" />
      </div>
      <div
        className="absolute inset-[37%] rounded-full p-1 motion-safe:animate-pulse-ring"
        style={{ background: ringBackground(0.68) }}
      >
        <div className="size-full rounded-full orb" />
      </div>
      {PILLARS.map((pillar) => {
        const Icon = pillarIcons[pillar];
        const angle = (ANGLES[pillar] * Math.PI) / 180;
        return (
          <span
            key={pillar}
            className="absolute flex size-[19%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-foreground/10 orb text-silver"
            style={{
              left: `${50 + RADIUS * Math.cos(angle)}%`,
              top: `${50 + RADIUS * Math.sin(angle)}%`,
            }}
          >
            <Icon className="size-[38%]" />
          </span>
        );
      })}
    </div>
  );
}
