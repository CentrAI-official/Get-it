import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";

// Sections de l'application mesurées par le dashboard : chaque adresse est
// ramenée à son modèle de route (« /community/posts/[id] »), à sa section et à
// sa catégorie de navigation. Le serveur fait ce calcul lui-même à partir du
// chemin reçu : le navigateur n'envoie jamais de section ni de cible.

/** Catégories : les cinq de la navigation, puis les espaces hors catégorie. */
export const ANALYTICS_CATEGORIES = [
  "community",
  "messages",
  "services",
  "marketplace",
  "profile",
  "today",
  "coach",
  "notifications",
  "onboarding",
  "other",
] as const;
export type AnalyticsCategory = (typeof ANALYTICS_CATEGORIES)[number];

/** Ce que désigne la partie variable d'une adresse, gardée comme cible si elle est valide. */
type TargetKind = "uuid" | "username" | "kind";

type RouteRule = {
  pattern: `/${string}`;
  section: string;
  /** Cible gardée (publication, annonce, membre…) ; rien pour ce qui est privé. */
  target?: TargetKind;
};

/**
 * Routes de l'application, les adresses fixes avant les adresses variables
 * (« /groups/new » avant « /groups/[id] »). Les objectifs et les conversations
 * ne gardent pas de cible : ils sont privés.
 */
export const ROUTE_RULES = [
  { pattern: "/community", section: "community.feed" },
  {
    pattern: "/community/posts/[id]",
    section: "community.post",
    target: "uuid",
  },
  {
    pattern: "/community/members/[username]",
    section: "community.member",
    target: "username",
  },
  {
    pattern: "/community/members/[username]/followers",
    section: "community.follows",
    target: "username",
  },
  {
    pattern: "/community/members/[username]/following",
    section: "community.follows",
    target: "username",
  },
  { pattern: "/groups", section: "community.groups" },
  { pattern: "/groups/new", section: "community.groups" },
  { pattern: "/groups/[id]", section: "community.group", target: "uuid" },
  { pattern: "/groups/[id]/edit", section: "community.group", target: "uuid" },
  { pattern: "/events", section: "community.events" },
  { pattern: "/events/new", section: "community.events" },
  { pattern: "/events/[id]", section: "community.event", target: "uuid" },
  {
    pattern: "/events/[id]/edit",
    section: "community.event",
    target: "uuid",
  },
  { pattern: "/moderation", section: "community.moderation" },
  { pattern: "/messages", section: "messages.inbox" },
  { pattern: "/messages/contacts", section: "messages.contacts" },
  { pattern: "/messages/new", section: "messages.new" },
  { pattern: "/messages/[id]", section: "messages.conversation" },
  { pattern: "/pro", section: "profile.pro" },
  { pattern: "/clients", section: "services.clients" },
  { pattern: "/clients/[id]", section: "services.clientFile" },
  { pattern: "/clients/[id]/plans/[kind]", section: "services.clientPlanEdit" },
  { pattern: "/pro/new", section: "profile.proEdit" },
  { pattern: "/pro/edit", section: "profile.proEdit" },
  { pattern: "/pages/[handle]", section: "marketplace.page" },
  { pattern: "/services", section: "services.calendar" },
  { pattern: "/services/events/new", section: "services.event" },
  { pattern: "/services/events/[id]", section: "services.event" },
  { pattern: "/services/physical", section: "services.section" },
  { pattern: "/services/physical/training", section: "services.plan" },
  {
    pattern: "/services/physical/training/exercises",
    section: "services.library",
  },
  { pattern: "/services/physical/nutrition", section: "services.plan" },
  {
    pattern: "/services/physical/nutrition/recipes",
    section: "services.library",
  },
  { pattern: "/services/mental", section: "services.plan" },
  { pattern: "/services/mental/tools", section: "services.library" },
  { pattern: "/services/social", section: "services.plan" },
  { pattern: "/services/social/tools", section: "services.library" },
  { pattern: "/services/financial", section: "services.plan" },
  { pattern: "/services/financial/budget", section: "services.budget" },
  {
    pattern: "/services/financial/budget/transactions",
    section: "services.budget",
  },
  { pattern: "/services/financial/budget/bills", section: "services.budget" },
  {
    pattern: "/services/financial/budget/accounts",
    section: "services.budget",
  },
  { pattern: "/services/financial/budget/goals", section: "services.budget" },
  { pattern: "/services/financial/budget/reports", section: "services.budget" },
  {
    pattern: "/services/library/[id]",
    section: "services.libraryItem",
    target: "uuid",
  },
  { pattern: "/marketplace", section: "marketplace.vitrine" },
  { pattern: "/marketplace/gear", section: "marketplace.gear" },
  { pattern: "/marketplace/favorites", section: "marketplace.favorites" },
  { pattern: "/marketplace/sell", section: "marketplace.sell" },
  { pattern: "/marketplace/mine", section: "marketplace.mine" },
  { pattern: "/marketplace/approvals", section: "marketplace.approvals" },
  {
    pattern: "/marketplace/[id]",
    section: "marketplace.listing",
    target: "uuid",
  },
  { pattern: "/profile", section: "profile.overview" },
  { pattern: "/profile/posts", section: "profile.posts" },
  { pattern: "/profile/pros", section: "profile.pros" },
  { pattern: "/profile/pros/changes/[id]", section: "profile.prosChange" },
  { pattern: "/profile/journal", section: "profile.journal" },
  { pattern: "/profile/journal/recap", section: "profile.journal" },
  { pattern: "/profile/ranked", section: "profile.ranked" },
  { pattern: "/profile/ranked/leaderboard", section: "profile.ranked" },
  { pattern: "/goals", section: "profile.goals" },
  { pattern: "/goals/new", section: "profile.goals" },
  { pattern: "/goals/[id]", section: "profile.goals" },
  { pattern: "/goals/[id]/edit", section: "profile.goals" },
  { pattern: "/habits", section: "profile.habits" },
  { pattern: "/habits/new", section: "profile.habits" },
  { pattern: "/habits/[id]/edit", section: "profile.habits" },
  { pattern: "/settings", section: "profile.settings" },
  { pattern: "/settings/music", section: "profile.settings" },
  { pattern: "/settings/library", section: "profile.settings" },
  { pattern: "/settings/library/new", section: "profile.settings" },
  { pattern: "/settings/library/[id]", section: "profile.settings" },
  { pattern: "/settings/feedback", section: "profile.settings" },
  { pattern: "/coach", section: "coach.chat" },
  { pattern: "/notifications", section: "notifications.list" },
  { pattern: "/onboarding", section: "onboarding.flow" },
  { pattern: "/onboarding/details", section: "onboarding.flow" },
] as const satisfies readonly RouteRule[];

/** Fenêtres sans adresse propre, mesurées à part. */
export const OVERLAY_SECTIONS = [
  "today.dayPanel",
  "community.storyViewer",
  "community.storyStudio",
] as const;
export type OverlaySection = (typeof OVERLAY_SECTIONS)[number];

export type RouteSection = (typeof ROUTE_RULES)[number]["section"];
export type AnalyticsSection = RouteSection | OverlaySection | "other";

export const ANALYTICS_SECTIONS: readonly AnalyticsSection[] = [
  ...new Set<AnalyticsSection>([
    ...ROUTE_RULES.map((rule) => rule.section),
    ...OVERLAY_SECTIONS,
    "other",
  ]),
];

/** Catégorie d'une section : le début de sa clé (« community.post » → community). */
export function categoryOf(section: string): AnalyticsCategory {
  const category = section.split(".")[0];
  return (
    ANALYTICS_CATEGORIES.find((candidate) => candidate === category) ?? "other"
  );
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const USERNAME = /^[a-z0-9_]{3,30}$/;
const KIND = /^[a-z_]{3,20}$/;

function validTarget(kind: TargetKind, value: string): string | null {
  const pattern =
    kind === "uuid" ? UUID : kind === "username" ? USERNAME : KIND;
  return pattern.test(value) ? value.toLowerCase() : null;
}

export type ResolvedPath = {
  section: AnalyticsSection;
  /** Modèle de la route ; null si l'adresse est inconnue. */
  route: string | null;
  target: string | null;
};

/**
 * Section, modèle de route et cible d'une adresse de l'application, avec ou
 * sans la langue (« /fr/community/posts/… »). Le paramètre de requête est ignoré.
 */
export function resolvePath(pathname: string): ResolvedPath {
  const [path = ""] = pathname.split(/[?#]/);
  const segments = path.split("/").filter(Boolean);
  if (hasLocale(routing.locales, segments[0])) segments.shift();

  for (const rule of ROUTE_RULES as readonly RouteRule[]) {
    const match = matchRule(rule.pattern, segments);
    if (!match) continue;
    return {
      section: rule.section as RouteSection,
      route: rule.pattern,
      target:
        rule.target && match.dynamic !== null
          ? validTarget(rule.target, match.dynamic)
          : null,
    };
  }
  return { section: "other", route: null, target: null };
}

/** L'adresse correspond-elle au modèle ? Renvoie alors sa partie variable (la première). */
function matchRule(
  pattern: string,
  segments: readonly string[],
): { dynamic: string | null } | null {
  const parts = pattern.split("/").filter(Boolean);
  if (parts.length !== segments.length) return null;
  let dynamic: string | null = null;
  for (const [index, part] of parts.entries()) {
    const segment = segments[index] ?? "";
    if (part.startsWith("[")) {
      if (segment.length === 0) return null;
      dynamic ??= segment;
    } else if (part !== segment) {
      return null;
    }
  }
  return { dynamic };
}
