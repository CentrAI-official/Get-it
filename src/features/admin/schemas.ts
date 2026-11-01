import { hasLocale, type Locale } from "next-intl";
import { z } from "zod";
import { emailSchema } from "@/features/auth/schemas";
import { routing } from "@/i18n/routing";

// Formulaires de connexion de l'application admin, revalidés par le serveur.

const locale = z
  .string()
  .refine((value): value is Locale => hasLocale(routing.locales, value));

export const adminSignInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
  locale,
});

export const adminCodeSchema = z.object({
  /** Code à 6 chiffres de l'application d'authentification (espaces retirés). */
  code: z
    .string()
    .transform((value) => value.replace(/\s/g, ""))
    .pipe(z.string().regex(/^\d{6}$/)),
  /** Application en cours de liaison (première connexion) ; sinon celle déjà reliée. */
  factorId: z.uuid().optional(),
  locale,
});

export const ADMIN_FORM_ERRORS = [
  "invalid",
  "denied",
  "rateLimited",
  "unavailable",
  "code",
  "unexpected",
] as const;
export type AdminFormError = (typeof ADMIN_FORM_ERRORS)[number];

export type AdminFormState = { error: AdminFormError | null };
export const initialAdminFormState: AdminFormState = { error: null };
