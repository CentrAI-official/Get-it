/** Ancre du formulaire de publication du Centre (bouton « + » → « Publication »). */
export const NEW_POST_ANCHOR = "nouvelle-publication";

/**
 * Place le curseur dans le formulaire de publication, s'il est affiché (Next
 * garde les pages quittées cachées dans le DOM). Vrai si c'est fait.
 */
export function focusComposer() {
  const field = Array.from(
    document.querySelectorAll<HTMLTextAreaElement>(
      `#${NEW_POST_ANCHOR} textarea`,
    ),
  ).find((element) => element.offsetParent !== null);
  if (!field) return false;

  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  field.focus({ preventScroll: true });
  field.scrollIntoView({
    block: "center",
    behavior: reduceMotion ? "auto" : "smooth",
  });
  return true;
}
