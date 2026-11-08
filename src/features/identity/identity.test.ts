import { describe, expect, it } from "vitest";
import { identityFromCookie, isIdentity } from "@/config/identity";
import { identityRedirect } from "./routes";

describe("identityFromCookie", () => {
  it("lit la page seulement quand le cookie la demande", () => {
    expect(identityFromCookie("page")).toBe("page");
    expect(identityFromCookie(undefined)).toBe("personal");
    expect(identityFromCookie("admin")).toBe("personal");
    expect(isIdentity("page")).toBe(true);
    expect(isIdentity("pro")).toBe(false);
  });
});

describe("identityRedirect", () => {
  it("sur sa page, les sections du compte personnel mènent à celles de la page", () => {
    expect(identityRedirect("/services", "page")).toBe("/clients");
    expect(identityRedirect("/services/financial/budget", "page")).toBe(
      "/clients",
    );
    expect(identityRedirect("/profile/journal", "page")).toBe("/pro");
    expect(identityRedirect("/goals/42", "page")).toBe("/pro");
    expect(identityRedirect("/coach", "page")).toBe("/community");
    expect(identityRedirect("/messages/new", "page")).toBe("/messages");
    expect(identityRedirect("/pro/new", "page")).toBe("/pro");
  });

  it("sur sa page, les sections partagées restent", () => {
    for (const path of [
      "/community",
      "/community/posts/1",
      "/messages",
      "/messages/42",
      "/marketplace",
      "/pages/coach-max",
      "/pro",
      "/pro/edit",
      "/clients",
      "/settings",
      "/notifications",
    ]) {
      expect(identityRedirect(path, "page")).toBeNull();
    }
  });

  it("sur son compte, les sections de la page mènent au profil", () => {
    expect(identityRedirect("/clients", "personal")).toBe("/services");
    expect(identityRedirect("/pro", "personal")).toBe("/profile");
    expect(identityRedirect("/pro/edit", "personal")).toBe("/profile");
    // Créer sa page se fait depuis son compte
    expect(identityRedirect("/pro/new", "personal")).toBeNull();
    expect(identityRedirect("/services", "personal")).toBeNull();
    expect(identityRedirect("/profile-old", "page")).toBeNull();
  });
});
