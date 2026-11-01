import { useEffect } from "react";

// Envoi des erreurs du navigateur au dashboard de l'équipe (composants client
// seulement). Le serveur nettoie le message ; ici, on évite les doublons et le
// bruit des extensions du navigateur.

const ENDPOINT = "/api/v1/errors";
/** Au plus 10 erreurs par chargement de page. */
const MAX_PER_PAGE = 10;
const sent = new Set<string>();

/** Bruit connu, sans rapport avec l'application. */
const IGNORED = [/ResizeObserver loop/i, /^Script error\.?$/i];

export function reportClientError(error: unknown) {
  try {
    const name = error instanceof Error ? error.name : undefined;
    const message = error instanceof Error ? error.message : String(error);
    const digest =
      typeof error === "object" &&
      error !== null &&
      "digest" in error &&
      typeof error.digest === "string"
        ? error.digest
        : undefined;
    if (IGNORED.some((pattern) => pattern.test(message))) return;
    const path = window.location.pathname;
    const key = `${path}|${message}`;
    if (sent.has(key) || sent.size >= MAX_PER_PAGE) return;
    sent.add(key);
    void fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      keepalive: true,
      body: JSON.stringify({
        ...(name ? { name: name.slice(0, 80) } : {}),
        message: message.slice(0, 2000),
        ...(digest ? { digest: digest.slice(0, 80) } : {}),
        path: path.slice(0, 300),
      }),
    }).catch(() => undefined);
  } catch {
    // Le signalement ne doit jamais provoquer une autre erreur
  }
}

/** Écoute les erreurs non attrapées de la page (scripts de l'application seulement). */
export function useErrorReporting() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      // Une erreur d'une extension ou d'un autre site ne nous concerne pas
      if (
        event.filename &&
        !event.filename.startsWith(window.location.origin)
      ) {
        return;
      }
      reportClientError(event.error ?? event.message);
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      reportClientError(event.reason);
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
}
