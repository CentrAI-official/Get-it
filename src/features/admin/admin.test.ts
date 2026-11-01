import { describe, expect, it } from "vitest";
import { adminCodeSchema, adminSignInSchema } from "./schemas";
import { adminSurfaceRedirect, isAdminPath } from "./surface";

describe("application admin", () => {
  it("ne sert que /admin : le reste mène au dashboard", () => {
    expect(adminSurfaceRedirect("/fr/admin")).toBeNull();
    expect(adminSurfaceRedirect("/en/admin/sign-in")).toBeNull();
    expect(adminSurfaceRedirect("/fr/community")).toBe("/fr/admin");
    expect(adminSurfaceRedirect("/en/")).toBe("/en/admin");
    expect(adminSurfaceRedirect("/fr/administration")).toBe("/fr/admin");
    // Sans langue : next-intl l'ajoute d'abord
    expect(adminSurfaceRedirect("/community")).toBeNull();
    expect(isAdminPath("/admin/retention")).toBe(true);
    expect(isAdminPath("/admins")).toBe(false);
  });

  it("revalide le code à 6 chiffres", () => {
    const code = (value: string) =>
      adminCodeSchema.safeParse({ code: value, locale: "fr" });
    expect(code("123 456")).toMatchObject({
      success: true,
      data: { code: "123456" },
    });
    expect(code("12345").success).toBe(false);
    expect(code("12345a").success).toBe(false);
    expect(
      adminCodeSchema.safeParse({ code: "123456", locale: "de" }).success,
    ).toBe(false);
    expect(
      adminCodeSchema.safeParse({
        code: "123456",
        factorId: "pas-un-uuid",
        locale: "fr",
      }).success,
    ).toBe(false);
  });

  it("revalide la connexion", () => {
    expect(
      adminSignInSchema.safeParse({
        email: "equipe@example.com",
        password: "secret",
        locale: "fr",
      }).success,
    ).toBe(true);
    // Courriel rempli automatiquement avec une espace ou des majuscules
    expect(
      adminSignInSchema.safeParse({
        email: " Equipe@Example.com ",
        password: "secret",
        locale: "fr",
      }),
    ).toMatchObject({ success: true, data: { email: "equipe@example.com" } });
    expect(
      adminSignInSchema.safeParse({
        email: "pas un courriel",
        password: "secret",
        locale: "fr",
      }).success,
    ).toBe(false);
  });
});
