import type { Identity } from "@/config/identity";
import {
  CalendarDays,
  ClipboardList,
  Contact,
  Handshake,
  Heart,
  MessageCircle,
  Pencil,
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
  | "community"
  | "messages"
  | "services"
  | "clients"
  | "marketplace"
  | "profile"
  | "page";

export type AppNavItem = {
  key: AppNavKey;
  href: `/${string}`;
  icon: LucideIcon;
  /** Autres sections regroupées sous cette catégorie (ex. objectifs dans Profil). */
  includes?: readonly `/${string}`[];
  /** Seulement sur le compte personnel, ou seulement sur sa page (mode page). */
  identity?: Identity;
};

/**
 * Les cinq catégories de la barre du bas (§61), « Mes services » au centre.
 * La Communauté est l'accueil. Sur sa page (mode page), Clients remplace Mon
 * développement et la page remplace Profil : chaque catégorie en double est
 * cachée par `identityClass` selon le compte actif.
 */
export const appNavItems = [
  {
    key: "community",
    href: "/community",
    icon: Users,
    includes: ["/groups", "/events", "/moderation"],
  },
  { key: "messages", href: "/messages", icon: MessageCircle },
  { key: "services", href: "/services", icon: Handshake, identity: "personal" },
  { key: "clients", href: "/clients", icon: ClipboardList, identity: "page" },
  {
    key: "marketplace",
    href: "/marketplace",
    icon: ShoppingBag,
    includes: ["/pages"],
  },
  {
    key: "profile",
    href: "/profile",
    icon: UserRound,
    includes: ["/goals", "/habits", "/settings", "/pro/new"],
    identity: "personal",
  },
  {
    key: "page",
    href: "/pro",
    icon: Store,
    includes: ["/settings"],
    identity: "page",
  },
] as const satisfies readonly AppNavItem[];

/** Classe qui cache un élément sous l'autre compte (voir globals.css). */
export function identityClass(identity: Identity | undefined) {
  return identity === "personal"
    ? "identity-personal"
    : identity === "page"
      ? "identity-page"
      : undefined;
}

export type TopActionKey =
  | "groups"
  | "events"
  | "coach"
  | "contacts"
  | "newMessage"
  | "shopServices"
  | "sell"
  | "favorites"
  | "settings"
  | "editPage";

export type TopAction = {
  key: TopActionKey;
  href: `/${string}`;
  icon: LucideIcon;
  /** Seulement sur le compte personnel, ou seulement sur sa page. */
  identity?: Identity;
};

/** Boutons du haut à droite. */
export const topActions = {
  groups: {
    key: "groups",
    href: "/groups",
    icon: UsersRound,
    identity: "personal",
  },
  events: {
    key: "events",
    href: "/events",
    icon: CalendarDays,
    identity: "personal",
  },
  // Get iT AI est le coach personnel : il lit les données du compte, pas celles de la page
  coach: { key: "coach", href: "/coach", icon: Sparkles, identity: "personal" },
  contacts: {
    key: "contacts",
    href: "/messages/contacts",
    icon: Contact,
    identity: "personal",
  },
  newMessage: {
    key: "newMessage",
    href: "/messages/new",
    icon: SquarePen,
    identity: "personal",
  },
  shopServices: { key: "shopServices", href: "/marketplace", icon: Store },
  sell: { key: "sell", href: "/marketplace/sell", icon: Tag },
  favorites: {
    key: "favorites",
    href: "/marketplace/favorites",
    icon: Heart,
    identity: "personal",
  },
  settings: { key: "settings", href: "/settings", icon: Settings },
  editPage: {
    key: "editPage",
    href: "/pro/edit",
    icon: Pencil,
    identity: "page",
  },
} as const satisfies Record<TopActionKey, TopAction>;

/** Boutons du haut propres à chaque catégorie ; Get iT AI est partout. */
export const categoryActions: Record<AppNavKey, readonly TopActionKey[]> = {
  community: ["groups", "events", "coach"],
  messages: ["contacts", "newMessage", "coach"],
  services: ["shopServices", "coach"],
  clients: [],
  marketplace: ["favorites", "sell", "coach"],
  profile: ["settings", "coach"],
  page: ["editPage", "settings"],
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

/**
 * Catégorie de la page courante ; null hors catégorie (ex. Get iT AI). Les
 * Réglages sont dans Profil, et dans la page en mode page (mêmes boutons).
 */
export function currentCategory(pathname: string): AppNavKey | null {
  return appNavItems.find((item) => isActiveItem(pathname, item))?.key ?? null;
}
