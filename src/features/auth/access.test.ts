import { describe, expect, it } from "vitest";
import { appNavItems, settingsNavItem } from "@/components/layout/nav-items";
import { getAuthRedirect, PROTECTED_PATHS } from "./access";

const visitor = { search: "", isAuthenticated: false };
const member = { search: "", isAuthenticated: true };

describe("getAuthRedirect", () => {
  it("envoie un visiteur vers la connexion en gardant la page demandée", () => {
    expect(
      getAuthRedirect({
        ...visitor,
        pathname: "/fr/goals/42",
        search: "?tab=done",
      }),
    ).toBe("/fr/login?next=%2Fgoals%2F42%3Ftab%3Ddone");
  });

  it("laisse un visiteur voir le site public et les pages de connexion", () => {
    for (const pathname of [
      "/fr",
      "/en/login",
      "/fr/signup",
      "/fr/forgot-password",
    ]) {
      expect(getAuthRedirect({ ...visitor, pathname })).toBeNull();
    }
  });

  it("renvoie un visiteur sans session vers la demande d'un nouveau lien", () => {
    expect(
      getAuthRedirect({ ...visitor, pathname: "/en/reset-password" }),
    ).toBe("/en/forgot-password");
  });

  it("envoie un utilisateur connecté directement dans l'application", () => {
    expect(getAuthRedirect({ ...member, pathname: "/en" })).toBe("/en/today");
    expect(getAuthRedirect({ ...member, pathname: "/fr/login" })).toBe(
      "/fr/today",
    );
  });

  it("laisse un utilisateur connecté utiliser l'application et changer son mot de passe", () => {
    for (const pathname of [
      "/fr/today",
      "/fr/settings",
      "/fr/reset-password",
    ]) {
      expect(getAuthRedirect({ ...member, pathname })).toBeNull();
    }
  });

  it("ne confond pas une page avec une autre qui commence pareil", () => {
    expect(getAuthRedirect({ ...visitor, pathname: "/fr/goalsx" })).toBeNull();
  });

  it("laisse next-intl gérer les chemins sans langue", () => {
    expect(getAuthRedirect({ ...visitor, pathname: "/goals" })).toBeNull();
  });

  it("protège chaque section de la navigation", () => {
    for (const { href } of [...appNavItems, settingsNavItem]) {
      expect(PROTECTED_PATHS).toContain(href);
    }
  });

  it("protège la page de modération, absente de la navigation", () => {
    expect(getAuthRedirect({ ...visitor, pathname: "/fr/moderation" })).toBe(
      "/fr/login?next=%2Fmoderation",
    );
  });
});
