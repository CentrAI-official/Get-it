import type { DevelopmentKind } from "./questionnaires";

// Couleurs des plans dans le calendrier et les raccourcis (classes Tailwind,
// tirées des couleurs de graphique de globals.css). Utilisables côté serveur.

/** Couleur de chaque plan dans le calendrier ; neutre hors plan. */
export const KIND_COLORS: Record<
  DevelopmentKind,
  { dot: string; tint: string; text: string }
> = {
  physical: { dot: "bg-primary", tint: "bg-primary/14", text: "text-primary" },
  mental: { dot: "bg-chart-2", tint: "bg-chart-2/12", text: "text-chart-2" },
  financial: { dot: "bg-chart-3", tint: "bg-chart-3/10", text: "text-chart-3" },
  social: { dot: "bg-chart-4", tint: "bg-chart-4/14", text: "text-chart-4" },
  business: { dot: "bg-foreground", tint: "bg-white/8", text: "text-silver" },
};

export const NEUTRAL_COLORS = {
  dot: "bg-white/40",
  tint: "bg-white/5",
  text: "text-muted-foreground",
};

export const colorsOf = (kind: DevelopmentKind | null) =>
  kind ? KIND_COLORS[kind] : NEUTRAL_COLORS;
