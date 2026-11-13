import { describe, expect, it } from "vitest";
import {
  cityOf,
  sameClock,
  timeZoneOptions,
  TIME_ZONE_CHOICES,
} from "./time-zones";

const NOV = new Date("2026-11-12T15:00:00Z");
const JULY = new Date("2026-07-01T15:00:00Z");

describe("sameClock", () => {
  it("Montréal et Toronto ont la même heure toute l'année", () => {
    expect(sameClock("America/Montreal", "America/Toronto", NOV)).toBe(true);
    expect(sameClock("America/Montreal", "America/Toronto", JULY)).toBe(true);
  });

  it("Vancouver n'est pas à l'heure de Toronto", () => {
    expect(sameClock("America/Vancouver", "America/Toronto", NOV)).toBe(false);
  });

  it("Regina n'a pas d'heure d'été : différente de Winnipeg une partie de l'année", () => {
    // En novembre, les deux sont à UTC−6 ; en été, Winnipeg passe à UTC−5
    expect(sameClock("America/Regina", "America/Winnipeg", NOV)).toBe(false);
  });

  it("un fuseau inconnu n'est jamais le même", () => {
    expect(sameClock("Mars/Olympus", "America/Toronto", NOV)).toBe(false);
  });
});

describe("cityOf et timeZoneOptions", () => {
  it("la ville d'un fuseau", () => {
    expect(cityOf("America/St_Johns")).toBe("St Johns");
    expect(cityOf("Pacific/Honolulu")).toBe("Honolulu");
  });

  it("la liste ajoute le fuseau du téléphone s'il n'y est pas, une seule fois", () => {
    const list = timeZoneOptions(
      "Europe/Paris",
      "America/Toronto",
      null,
      "Bad/Zone",
    );
    expect(list).toHaveLength(TIME_ZONE_CHOICES.length + 1);
    expect(list.at(-1)).toBe("Europe/Paris");
  });
});
