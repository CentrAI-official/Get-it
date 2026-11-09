import type { Identity } from "@/config/identity";

// Les sections propres à un seul des deux comptes. Sur sa page, celles du
// compte personnel mènent à leur équivalent de la page, et inversement :
// on ne publie ou n'écrit jamais sous le mauvais nom par un vieux lien.

type Rule = {
  from: `/${string}`;
  to: `/${string}`;
  /** Seulement l'adresse exacte, pas ses sous-pages. */
  exact?: boolean;
};

const PAGE_RULES: readonly Rule[] = [
  { from: "/services", to: "/clients" },
  { from: "/profile", to: "/pro" },
  { from: "/goals", to: "/pro" },
  { from: "/habits", to: "/pro" },
  { from: "/pro/new", to: "/pro" },
  { from: "/groups", to: "/community" },
  { from: "/coach", to: "/community" },
  { from: "/messages/new", to: "/messages" },
  { from: "/messages/contacts", to: "/messages" },
  { from: "/marketplace/favorites", to: "/marketplace" },
];

const PERSONAL_RULES: readonly Rule[] = [
  { from: "/clients", to: "/services" },
  { from: "/pro", to: "/profile", exact: true },
  { from: "/pro/edit", to: "/profile" },
];

const matches = (path: string, rule: Rule) =>
  path === rule.from || (!rule.exact && path.startsWith(`${rule.from}/`));

/**
 * Où envoyer une adresse (sans la langue) qui n'existe pas pour le compte
 * actif ; null si elle y existe.
 */
export function identityRedirect(
  path: string,
  identity: Identity,
): `/${string}` | null {
  const rules = identity === "page" ? PAGE_RULES : PERSONAL_RULES;
  return rules.find((rule) => matches(path, rule))?.to ?? null;
}
