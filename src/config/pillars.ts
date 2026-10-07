import { Brain, Dumbbell, Users, Wallet, type LucideIcon } from "lucide-react";

/** Les quatre piliers de Get iT. L'ordre est celui de l'affichage. */
export const PILLARS = ["physical", "mental", "social", "financial"] as const;

export type Pillar = (typeof PILLARS)[number];

export const pillarIcons: Record<Pillar, LucideIcon> = {
  physical: Dumbbell,
  mental: Brain,
  social: Users,
  financial: Wallet,
};
