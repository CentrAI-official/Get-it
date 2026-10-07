/**
 * Chemin interne sûr vers lequel rediriger après la connexion, ou null.
 * Refuse tout ce qui pourrait mener vers un autre site (redirection ouverte).
 */
export function safeNextPath(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 512) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  // Barres obliques inverses et caractères de contrôle : interprétés différemment selon les navigateurs
  if (/[\\\u0000-\u001f]/.test(value)) return null;
  return value;
}
