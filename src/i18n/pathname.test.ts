import { describe, expect, it } from "vitest";
import { stripLocalePrefix } from "./pathname";

describe("stripLocalePrefix", () => {
  it("retire la langue du chemin", () => {
    expect(stripLocalePrefix("/fr/goals/42")).toBe("/goals/42");
    expect(stripLocalePrefix("/en")).toBe("/");
  });

  it("laisse intact un chemin sans langue", () => {
    expect(stripLocalePrefix("/goals")).toBe("/goals");
    expect(stripLocalePrefix("/french-fries")).toBe("/french-fries");
  });
});
