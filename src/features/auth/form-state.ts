import type { z } from "zod";
import { isAuthErrorKey, type AuthErrorKey } from "./errors";

export type AuthField = "email" | "password" | "confirmPassword";

/** État renvoyé par les Server Actions d'authentification à leur formulaire. */
export type AuthFormState = {
  status: "idle" | "error" | "success";
  /** Erreur générale, affichée en haut du formulaire. */
  error?: AuthErrorKey;
  fieldErrors?: Partial<Record<AuthField, AuthErrorKey>>;
  /** Courriel saisi, réaffiché après une erreur ou dans le message de succès. */
  email?: string;
};

export const initialAuthFormState: AuthFormState = { status: "idle" };

/** Convertit une erreur de validation Zod en erreurs par champ. */
export function toFieldErrors(
  error: z.ZodError,
): Partial<Record<AuthField, AuthErrorKey>> {
  const fieldErrors: Partial<Record<AuthField, AuthErrorKey>> = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (
      field !== "email" &&
      field !== "password" &&
      field !== "confirmPassword"
    ) {
      continue;
    }
    fieldErrors[field] ??= isAuthErrorKey(issue.message)
      ? issue.message
      : "unexpected";
  }
  return fieldErrors;
}
