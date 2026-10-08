import type { z } from "zod";

/**
 * Première erreur de chaque champ d'un formulaire. Les schémas utilisent des clés
 * de traduction comme messages ; tout autre message devient `fallback`.
 */
export function fieldErrorsFrom<Field extends string, Key extends string>(
  error: z.ZodError,
  fields: readonly Field[],
  isKey: (value: unknown) => value is Key,
  fallback: Key,
): Partial<Record<Field, Key>> {
  const result: Partial<Record<Field, Key>> = {};
  for (const issue of error.issues) {
    const field = fields.find((name) => name === issue.path[0]);
    if (!field || result[field]) continue;
    result[field] = isKey(issue.message) ? issue.message : fallback;
  }
  return result;
}
