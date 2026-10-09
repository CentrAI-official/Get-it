/** Ancre du formulaire d'ajout de tâche de la page Aujourd'hui (bouton « + »). */
export const NEW_TASK_ANCHOR = "nouvelle-tache";

/**
 * Place le curseur dans le formulaire d'ajout de tâche, s'il est affiché
 * (Next garde les pages quittées cachées dans le DOM). Vrai si c'est fait.
 */
export function focusNewTaskForm() {
  const input = Array.from(
    document.querySelectorAll<HTMLInputElement>(
      `#${NEW_TASK_ANCHOR} input[name="title"]`,
    ),
  ).find((element) => element.offsetParent !== null);
  if (!input) return false;

  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  input.focus({ preventScroll: true });
  input.scrollIntoView({
    block: "center",
    behavior: reduceMotion ? "auto" : "smooth",
  });
  return true;
}
