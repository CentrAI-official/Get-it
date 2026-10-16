import { describe, expect, it } from "vitest";
import { appNavItems, isActiveItem, isActivePath } from "./nav-items";

describe("isActivePath", () => {
  it("active le lien de la page courante", () => {
    expect(isActivePath("/goals", "/goals")).toBe(true);
  });

  it("active le lien parent sur une sous-page", () => {
    expect(isActivePath("/goals/42", "/goals")).toBe(true);
  });

  it("n'active pas un lien qui partage seulement le début du nom", () => {
    expect(isActivePath("/goals-archive", "/goals")).toBe(false);
  });

  it("n'active pas un autre lien", () => {
    expect(isActivePath("/community", "/goals")).toBe(false);
  });
});

describe("isActiveItem", () => {
  const profile = appNavItems.find((item) => item.key === "profile");

  it("garde Profil actif sur les objectifs et les habitudes", () => {
    expect(profile).toBeDefined();
    if (!profile) return;
    for (const pathname of ["/profile", "/goals/42", "/habits/new"]) {
      expect(isActiveItem(pathname, profile)).toBe(true);
    }
    expect(isActiveItem("/community", profile)).toBe(false);
  });

  it("met la Communauté en premier : c'est l'accueil", () => {
    expect(appNavItems.map((item) => item.key)).toEqual([
      "community",
      "events",
      "marketplace",
      "profile",
    ]);
  });
});
