import type { Identity } from "@/config/identity";

/**
 * Le compte sous lequel l'écran a été chargé (posé par IdentityScript). Envoyé
 * avec une publication, un commentaire ou un « J'aime » : si on a changé de
 * compte dans un autre onglet, le serveur refuse plutôt que d'agir sous le
 * mauvais nom.
 */
export function currentIdentity(): Identity {
  return document.documentElement.getAttribute("data-identity") === "page"
    ? "page"
    : "personal";
}

/**
 * Navigation complète (pas celle du routeur de Next) après un changement de
 * compte : IdentityScript relit le cookie, et aucun écran gardé en cache par
 * le routeur ne reste sous l'autre compte.
 */
export function reloadTo(locale: string, path: `/${string}`) {
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- rechargement complet voulu
  window.location.assign(`${window.location.origin}/${locale}${path}`);
}
