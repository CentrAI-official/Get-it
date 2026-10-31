import { createNavigation } from "next-intl/navigation";
import { createElement, type ComponentProps } from "react";
import { routing } from "./routing";

// Versions de Link, redirect, etc. qui conservent la langue courante dans l'URL
const navigation = createNavigation(routing);
export const { redirect, usePathname, useRouter, getPathname } = navigation;

/**
 * Animations entre les pages (voir globals.css) : on avance (la page glisse
 * depuis la droite), on revient (depuis la gauche), ou on change d'onglet
 * (fondu). Les navigations sans type (retour du navigateur, rafraîchissement)
 * ne s'animent pas.
 */
export type PageTransition = "nav-forward" | "nav-back" | "nav-tab";

/** Lien interne : par défaut, la page suivante arrive en glissant, comme sur Instagram. */
export function Link(props: ComponentProps<typeof navigation.Link>) {
  return createElement(navigation.Link, {
    transitionTypes: ["nav-forward"] satisfies PageTransition[],
    ...props,
  });
}
