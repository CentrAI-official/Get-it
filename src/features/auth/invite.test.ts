import { describe, expect, it } from "vitest";
import { normalizeInviteCode } from "./invite";
import { signUpSchema } from "./schemas";

describe("code d'invitation", () => {
  it("se compare sans espaces autour ni majuscules", () => {
    expect(normalizeInviteCode("  getit-2026 ")).toBe("GETIT-2026");
    expect(normalizeInviteCode("GetIt-2026")).toBe(
      normalizeInviteCode("getit-2026"),
    );
  });

  it("vaut une chaîne vide quand il manque", () => {
    expect(normalizeInviteCode(undefined)).toBe("");
    expect(normalizeInviteCode(42)).toBe("");
  });

  it("est facultatif dans le formulaire, mais borné", () => {
    const base = {
      locale: "fr",
      email: "a@example.com",
      password: "un-mot-de-passe-solide",
    };
    expect(signUpSchema.safeParse(base).success).toBe(true);
    expect(
      signUpSchema.safeParse({ ...base, inviteCode: "GETIT-2026" }).success,
    ).toBe(true);
    expect(
      signUpSchema.safeParse({ ...base, inviteCode: "x".repeat(65) }).success,
    ).toBe(false);
  });
});
