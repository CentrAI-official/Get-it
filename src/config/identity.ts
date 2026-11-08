// Compte actif (décision du fondateur, 2026-11-07, comme sur Facebook) : son
// compte personnel ou sa page pro. Le choix est gardé dans un cookie de
// l'appareil, lu avant l'affichage pour la navigation (sans clignotement) et
// revérifié par le serveur à chaque requête : le cookie ne donne aucun droit.

export const IDENTITIES = ["personal", "page"] as const;
export type Identity = (typeof IDENTITIES)[number];

export const IDENTITY_COOKIE = "identity";

/** Un an : on retrouve sa page en rouvrant l'application. */
export const IDENTITY_COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

export function isIdentity(value: unknown): value is Identity {
  return IDENTITIES.some((identity) => identity === value);
}

/** Le compte du cookie : « personal » quand il est absent ou invalide. */
export function identityFromCookie(value: string | undefined): Identity {
  return value === "page" ? "page" : "personal";
}

/**
 * Script exécuté avant l'affichage (dans le <body> de la mise en page racine) :
 * `data-identity="page"` sur <html> montre la navigation de la page
 * (`identity-page`) et cache ce qui n'existe que pour le compte personnel
 * (`identity-personal`, voir globals.css).
 */
export const IDENTITY_SCRIPT = `(function () {
  if (/(?:^|; )${IDENTITY_COOKIE}=page(?:;|$)/.test(document.cookie)) {
    document.documentElement.setAttribute("data-identity", "page");
  }
})();`;
