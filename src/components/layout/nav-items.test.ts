import { describe, expect, it } from "vitest";
import { isActivePath } from "./nav-items";

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
    expect(isActivePath("/today", "/goals")).toBe(false);
  });
});
