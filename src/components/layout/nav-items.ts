import {
  CalendarDays,
  Contact,
  Handshake,
  MessageCircle,
  Settings,
  ShoppingBag,
  Sparkles,
  SquarePen,
  Store,
  Tag,
  UserRound,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

export type AppNavKey =
  "community" | "messages" | "services" | "marketplace" | "profile";

export type AppNavItem = {
  key: AppNavKey;
  href: `/${string}`;
  icon: LucideIcon;
  /** Autres sections regroupées sous cette catégorie (ex. objectifs dans Profil). */
  includes?: readonly `/${string}`[];
};

/**
 * Les cinq catégories de la barre du bas (§61), « Mes services » au centre.
 * La Communauté est l'accueil.
 */
export const appNavItems = [
  {
    key: "community",
    href: "/community",
    icon: Users,
    includes: ["/groups", "/events", "/moderation"],
  },
  { key: "messages", href: "/messages", icon: MessageCircle },
  { key: "services", href: "/services", icon: Handshake },
  { key: "marketplace", href: "/marketplace", icon: ShoppingBag },
  {
    key: "profile",
    href: "/profile",
    icon: UserRound,
    includes: ["/goals", "/habits", "/settings"],
  },
] as const satisfies readonly AppNavItem[];

export type TopActionKey =
  | "groups"
  | "events"
  | "coach"
  | "contacts"
  | "newMessage"
  | "shopServices"
  | "sell"
  | "settings";

export type TopAction = {
  key: TopActionKey;
  href: `/${string}`;
  icon: LucideIcon;
};

/** Boutons du haut à droite. */
export const topActions = {
  groups: { key: "groups", href: "/groups", icon: UsersRound },
  events: { key: "events", href: "/events", icon: CalendarDays },
  coach: { key: "coach", href: "/coach", icon: Sparkles },
  contacts: { key: "contacts", href: "/messages/contacts", icon: Contact },
  newMessage: { key: "newMessage", href: "/messages/new", icon: SquarePen },
  shopServices: { key: "shopServices", href: "/marketplace", icon: Store },
  sell: { key: "sell", href: "/marketplace/sell", icon: Tag },
  settings: { key: "settings", href: "/settings", icon: Settings },
} as const satisfies Record<TopActionKey, TopAction>;

/** Boutons du haut propres à chaque catégorie ; Get iT AI est partout. */
export const categoryActions: Record<AppNavKey, readonly TopActionKey[]> = {
  community: ["groups", "events", "coach"],
  messages: ["contacts", "newMessage", "coach"],
  services: ["shopServices", "coach"],
  marketplace: ["sell", "coach"],
  profile: ["settings", "coach"],
};

/** Vrai si `href` correspond à la page courante ou à l'une de ses sous-pages. */
export function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Vrai si la catégorie couvre la page courante (y compris les sections regroupées). */
export function isActiveItem(pathname: string, item: AppNavItem) {
  return [item.href, ...(item.includes ?? [])].some((href) =>
    isActivePath(pathname, href),
  );
}

/** Catégorie de la page courante ; null hors catégorie (ex. Get iT AI). */
export function currentCategory(pathname: string): AppNavKey | null {
  return appNavItems.find((item) => isActiveItem(pathname, item))?.key ?? null;
}
