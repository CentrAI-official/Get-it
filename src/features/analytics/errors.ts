import { z } from "zod";

// Erreurs rencontrées dans l'application, enregistrées pour le dashboard de
// l'équipe sans données personnelles. Listes alignées sur la migration
// 20261110120000_feedback_errors (un test le vérifie).

export const ERROR_SOURCES = ["client", "server"] as const;
export type ErrorSource = (typeof ERROR_SOURCES)[number];

export const ERROR_MESSAGE_MAX = 300;
/** Au plus 30 erreurs par personne en 10 minutes, depuis le navigateur. */
export const CLIENT_ERROR_LIMIT = 30;
/** Au plus 60 erreurs serveur par minute et par instance. */
export const SERVER_ERROR_LIMIT = 60;

/** Erreur envoyée par le navigateur (le chemin sert seulement à trouver la page). */
export const clientErrorSchema = z.strictObject({
  name: z.string().max(80).optional(),
  message: z.string().max(2000),
  digest: z.string().max(80).optional(),
  path: z.string().startsWith("/").max(300),
});
export type ClientError = z.infer<typeof clientErrorSchema>;

/**
 * Message lisible et sans données personnelles : courriels, identifiants,
 * liens et longs nombres retirés, espaces resserrées, 300 caractères au plus.
 */
export function scrubErrorMessage(name: string | undefined, message: string) {
  const cleaned = message
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "[courriel]")
    .replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      "[id]",
    )
    .replace(/https?:\/\/\S+/g, "[lien]")
    .replace(/\d{4,}/g, "[n]")
    .replace(/\s+/g, " ")
    .trim();
  const prefix =
    name && name !== "Error" && !cleaned.startsWith(name) ? `${name}: ` : "";
  return `${prefix}${cleaned || "—"}`.slice(0, ERROR_MESSAGE_MAX);
}

/**
 * Modèle de route d'un fichier de l'App Router (« /app/[locale]/(app)/
 * community/posts/[id]/page ») : sans le dossier app, la langue, les groupes
 * ni le nom du fichier.
 */
export function routeFromRoutePath(routePath: string) {
  const parts = routePath.split("/").filter(Boolean);
  // Le chemin peut commencer par le dossier de l'App Router
  while (parts[0] === "src" || parts[0] === "app") parts.shift();
  const route = parts.filter(
    (part) =>
      part !== "[locale]" &&
      !(part.startsWith("(") && part.endsWith(")")) &&
      !/^(page|route|layout|default)$/.test(part),
  );
  return `/${route.join("/")}`.slice(0, 120);
}
