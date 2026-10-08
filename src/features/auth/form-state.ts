import type { z } from "zod";
import { fieldErrorsFrom } from "@/lib/form-errors";
import { isAuthErrorKey, type AuthErrorKey } from "./errors";

const AUTH_FIELDS = ["email", "password", "confirmPassword"] as const;
export type AuthField = (typeof AUTH_FIELDS)[number];

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
  return fieldErrorsFrom(error, AUTH_FIELDS, isAuthErrorKey, "unexpected");
}
