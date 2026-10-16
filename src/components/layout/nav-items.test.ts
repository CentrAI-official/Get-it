import { describe, expect, it } from "vitest";
import {
  appNavItems,
  categoryActions,
  currentCategory,
  isActiveItem,
  isActivePath,
} from "./nav-items";

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

  it("garde Profil actif sur les objectifs, les habitudes et les réglages", () => {
    expect(profile).toBeDefined();
    if (!profile) return;
    for (const pathname of [
      "/profile",
      "/goals/42",
      "/habits/new",
      "/settings",
    ]) {
      expect(isActiveItem(pathname, profile)).toBe(true);
    }
    expect(isActiveItem("/community", profile)).toBe(false);
  });
});

describe("catégories", () => {
  it("cinq catégories, « Mes services » au centre", () => {
    expect(appNavItems.map((item) => item.key)).toEqual([
      "community",
      "messages",
      "services",
      "marketplace",
      "profile",
    ]);
  });

  it("retrouve la catégorie de la page, Événements et Groupes dans la Communauté", () => {
    expect(currentCategory("/events")).toBe("community");
    expect(currentCategory("/groups")).toBe("community");
    expect(currentCategory("/marketplace/services")).toBe("marketplace");
    expect(currentCategory("/goals/42")).toBe("profile");
    expect(currentCategory("/coach")).toBeNull();
  });

  it("Get iT AI en haut de chaque catégorie, Réglages seulement dans Profil", () => {
    for (const actions of Object.values(categoryActions)) {
      expect(actions).toContain("coach");
    }
    expect(categoryActions.community).toEqual(["groups", "events", "coach"]);
    const withSettings = Object.entries(categoryActions)
      .filter(([, actions]) => actions.includes("settings"))
      .map(([key]) => key);
    expect(withSettings).toEqual(["profile"]);
  });
});
