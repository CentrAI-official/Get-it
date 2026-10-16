import {
  CalendarDays,
  Settings,
  ShoppingBag,
  Sparkles,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";

export type AppNavKey =
  "community" | "events" | "marketplace" | "profile" | "coach" | "settings";

export type AppNavItem = {
  key: AppNavKey;
  href: `/${string}`;
  icon: LucideIcon;
  /** Autres sections regroupées sous cet onglet (ex. objectifs dans Profil). */
  includes?: readonly `/${string}`[];
};

/** Les quatre catégories de l'application : la Communauté est l'accueil. */
export const appNavItems = [
  { key: "community", href: "/community", icon: Users },
  { key: "events", href: "/events", icon: CalendarDays },
  { key: "marketplace", href: "/marketplace", icon: ShoppingBag },
  {
    key: "profile",
    href: "/profile",
    icon: UserRound,
    includes: ["/goals", "/habits"],
  },
] as const satisfies readonly AppNavItem[];

/** Get iT AI : hors des catégories, accessible depuis toutes les pages. */
export const coachNavItem = {
  key: "coach",
  href: "/coach",
  icon: Sparkles,
} as const satisfies AppNavItem;

export const settingsNavItem = {
  key: "settings",
  href: "/settings",
  icon: Settings,
} as const satisfies AppNavItem;

/** Onglets de la barre mobile (§61), deux de chaque côté du bouton « + ». */
export const mobileNavItems: readonly AppNavItem[] = appNavItems;

/** Vrai si `href` correspond à la page courante ou à l'une de ses sous-pages. */
export function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Vrai si l'onglet couvre la page courante (y compris les sections regroupées). */
export function isActiveItem(pathname: string, item: AppNavItem) {
  return [item.href, ...(item.includes ?? [])].some((href) =>
    isActivePath(pathname, href),
  );
}
