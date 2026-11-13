import { unstable_isUnrecognizedActionError } from "next/navigation";

// Une nouvelle version de Get iT est en ligne : un écran ouvert avant la mise en
// ligne appelle une action qui n'existe plus. On recharge la page (une fois par
// minute au plus) plutôt que d'afficher une erreur. Navigateur seulement.

/** Vrai si l'erreur vient d'une version plus ancienne que celle en ligne. */
export function isOutdated(error: unknown) {
  if (!(error instanceof Error)) return false;
  const { message } = error;
  return (
    unstable_isUnrecognizedActionError(error) ||
    /Server Action .* was not found|Failed to find Server Action|ChunkLoadError|Loading chunk .* failed/i.test(
      message,
    )
  );
}

const RELOAD_KEY = "getit-update-reload";

/** Recharge une seule fois par minute : une page qui casse encore montre son erreur. */
export function reloadOnce() {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (Date.now() - last < 60_000) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // Stockage bloqué : on recharge quand même, une fois
  }
  window.location.reload();
  return true;
}

/** Dans un `catch` : recharge si l'écran est d'une ancienne version. */
export function reloadIfOutdated(error: unknown) {
  if (isOutdated(error)) reloadOnce();
}
