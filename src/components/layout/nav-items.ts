import {
  Repeat,
  Settings,
  Sparkles,
  Sun,
  Target,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";

export type AppNavKey =
  "today" | "goals" | "habits" | "coach" | "community" | "profile" | "settings";

export type AppNavItem = {
  key: AppNavKey;
  href: `/${string}`;
  icon: LucideIcon;
};

/** Sections principales de l'application (MVP). */
export const appNavItems = [
  { key: "today", href: "/today", icon: Sun },
  { key: "goals", href: "/goals", icon: Target },
  { key: "habits", href: "/habits", icon: Repeat },
  { key: "coach", href: "/coach", icon: Sparkles },
  { key: "community", href: "/community", icon: Users },
  { key: "profile", href: "/profile", icon: UserRound },
] as const satisfies readonly AppNavItem[];

export const settingsNavItem = {
  key: "settings",
  href: "/settings",
  icon: Settings,
} as const satisfies AppNavItem;

/**
 * Onglets de la barre mobile (§61), de part et d'autre du bouton « + » :
 * le coach et la communauté sont dans la barre du haut.
 */
export const mobileNavItems: readonly AppNavItem[] = appNavItems.filter(
  (item) => item.key !== "coach" && item.key !== "community",
);

/** Vrai si `href` correspond à la page courante ou à l'une de ses sous-pages. */
export function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
