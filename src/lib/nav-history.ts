// Pages vues dans l'application depuis son chargement (navigation du routeur),
// pour qu'un bouton « Retour » sache s'il peut revenir à la page d'avant ou
// s'il doit mener à une page parente (lien ouvert depuis une notification, une
// autre appli ou un nouvel onglet). Gardé en mémoire seulement.

let seen = 0;
let last: string | null = null;

/** Une page de plus (appelé à chaque changement d'adresse ; deux fois la même ne compte qu'une). */
export function noteNavigation(pathname: string) {
  if (pathname === last) return;
  last = pathname;
  seen += 1;
}

/** Vrai si une page de l'application précède celle-ci. */
export function canGoBack() {
  return seen > 1;
}
