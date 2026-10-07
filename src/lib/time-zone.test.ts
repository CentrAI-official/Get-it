import { describe, expect, it } from "vitest";
import { isValidTimeZone } from "./time-zone";

describe("isValidTimeZone", () => {
  it("accepte un fuseau IANA", () => {
    expect(isValidTimeZone("America/Toronto")).toBe(true);
    expect(isValidTimeZone("Europe/Paris")).toBe(true);
  });

  it("refuse une valeur inconnue ou invalide", () => {
    for (const value of ["", "Mars/Olympus", "<script>", 42, undefined]) {
      expect(isValidTimeZone(value)).toBe(false);
    }
  });
});
