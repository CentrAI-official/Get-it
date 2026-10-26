import { z } from "zod";
import { routing } from "@/i18n/routing";
import type { AuthErrorKey } from "./errors";

// Le minimum de Supabase (6) est trop faible ; 72 est la limite de bcrypt.
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;

/** Message d'erreur Zod = clé de traduction de `Auth.errors`. */
const error = (key: AuthErrorKey) => ({ error: key });

const email = z
  .string(error("emailInvalid"))
  .trim()
  .toLowerCase()
  .pipe(z.email(error("emailInvalid")).max(254, error("emailInvalid")));

const newPassword = z
  .string(error("passwordTooShort"))
  .min(PASSWORD_MIN_LENGTH, error("passwordTooShort"))
  .max(PASSWORD_MAX_LENGTH, error("passwordTooLong"));

const locale = z.enum(routing.locales);

export const signInSchema = z.object({
  locale,
  email,
  password: z
    .string(error("passwordRequired"))
    .min(1, error("passwordRequired")),
  next: z.string().optional(),
});

export const signUpSchema = z.object({
  locale,
  email,
  password: newPassword,
  // Fuseau du navigateur ; vérifié avant d'être enregistré (voir isValidTimeZone)
  timeZone: z.string().max(64).optional(),
  // Bêta privée : vérifié par le serveur (src/server/auth/invite.ts)
  inviteCode: z
    .string(error("inviteInvalid"))
    .max(64, error("inviteInvalid"))
    .optional(),
});

export const forgotPasswordSchema = z.object({ locale, email });

export const resetPasswordSchema = z
  .object({
    locale,
    password: newPassword,
    confirmPassword: z.string(error("passwordMismatch")),
  })
  .refine((data) => data.password === data.confirmPassword, {
    ...error("passwordMismatch"),
    path: ["confirmPassword"],
  });
