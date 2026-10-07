import { describe, expect, it } from "vitest";
import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";
import { AUTH_ERROR_KEYS, toAuthErrorKey } from "./errors";
import { toFieldErrors } from "./form-state";
import { safeNextPath } from "./redirect";
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from "./schemas";

describe("messages d'erreur", () => {
  it("existent pour chaque erreur possible", () => {
    for (const messages of [fr, en]) {
      expect(Object.keys(messages.Auth.errors).sort()).toEqual(
        [...AUTH_ERROR_KEYS].sort(),
      );
    }
  });

  it("reprennent les limites de longueur du mot de passe", () => {
    for (const messages of [fr, en]) {
      expect(messages.Auth.errors.passwordTooShort).toContain(
        String(PASSWORD_MIN_LENGTH),
      );
      expect(messages.Auth.errors.passwordTooLong).toContain(
        String(PASSWORD_MAX_LENGTH),
      );
    }
  });
});

describe("toAuthErrorKey", () => {
  it("traduit les codes connus de Supabase", () => {
    expect(toAuthErrorKey("invalid_credentials")).toBe("invalidCredentials");
    expect(toAuthErrorKey("over_email_send_rate_limit")).toBe("rateLimited");
  });

  it("rend une erreur générique pour un code inconnu ou absent", () => {
    expect(toAuthErrorKey("something_new")).toBe("unexpected");
    expect(toAuthErrorKey(undefined)).toBe("unexpected");
  });
});

describe("safeNextPath", () => {
  it("accepte un chemin interne", () => {
    expect(safeNextPath("/goals/42?tab=done")).toBe("/goals/42?tab=done");
  });

  it("refuse tout ce qui mène vers un autre site", () => {
    for (const value of [
      "https://evil.com",
      "//evil.com",
      "/\\evil.com",
      "evil.com",
      "/\tevil",
      undefined,
      42,
    ]) {
      expect(safeNextPath(value)).toBeNull();
    }
  });
});

describe("schémas d'authentification", () => {
  it("normalise le courriel", () => {
    const result = signInSchema.parse({
      locale: "fr",
      email: "  Max@Example.COM ",
      password: "x",
    });
    expect(result.email).toBe("max@example.com");
  });

  it("explique pourquoi un courriel ou un mot de passe est refusé", () => {
    const result = signUpSchema.safeParse({
      locale: "fr",
      email: "pas-un-courriel",
      password: "court",
    });
    expect(result.success).toBe(false);
    expect(toFieldErrors(result.error!)).toEqual({
      email: "emailInvalid",
      password: "passwordTooShort",
    });
  });

  it("refuse une langue non prise en charge", () => {
    const result = signUpSchema.safeParse({
      locale: "de",
      email: "max@example.com",
      password: "un-bon-mot-de-passe",
    });
    expect(result.success).toBe(false);
  });

  it("exige deux mots de passe identiques", () => {
    const result = resetPasswordSchema.safeParse({
      locale: "en",
      password: "un-bon-mot-de-passe",
      confirmPassword: "un-autre-mot-de-passe",
    });
    expect(result.success).toBe(false);
    expect(toFieldErrors(result.error!)).toEqual({
      confirmPassword: "passwordMismatch",
    });
  });
});
