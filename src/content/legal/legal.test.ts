import { describe, expect, it } from "vitest";
import en from "./en.json";
import fr from "./fr.json";

/** La forme d'un texte : les clés et le nombre de paragraphes, sans le texte. */
const shape = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(shape)
    : value && typeof value === "object"
      ? Object.fromEntries(
          Object.entries(value).map(([key, inner]) => [key, shape(inner)]),
        )
      : typeof value;

describe("textes légaux", () => {
  it("le français et l'anglais ont la même forme", () => {
    expect(shape(en)).toEqual(shape(fr));
  });

  it("les espaces insécables du français avant « : »", () => {
    expect(JSON.stringify(fr)).not.toMatch(/ :/);
  });

  it("la politique nomme la personne responsable et l'adresse", () => {
    expect(fr.privacy.officer).toContain("{name}");
    expect(fr.privacy.officer).toContain("{email}");
    expect(en.terms.contact).toContain("{email}");
  });
});
