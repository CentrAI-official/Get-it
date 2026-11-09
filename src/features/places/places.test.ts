import { describe, expect, it } from "vitest";
import { mapsUrl, placeSuggestion, placeSuggestions } from "./rules";

describe("lieux proposés", () => {
  it("un lieu nommé : son nom, puis l'adresse, la ville et la province", () => {
    expect(
      placeSuggestion(
        {
          properties: {
            osm_id: 42,
            osm_type: "W",
            name: "Centre Bell",
            housenumber: "1909",
            street: "Avenue des Canadiens-de-Montréal",
            city: "Montréal",
            state: "Québec",
            postcode: "H3B 5E8",
            country: "Canada",
            countrycode: "CA",
          },
        },
        200,
      ),
    ).toEqual({
      id: "W42",
      primary: "Centre Bell",
      secondary: "1909 Avenue des Canadiens-de-Montréal, Montréal, QC H3B 5E8",
      label:
        "Centre Bell, 1909 Avenue des Canadiens-de-Montréal, Montréal, QC H3B 5E8",
    });
  });

  it("une adresse sans nom, et le pays hors du Canada", () => {
    const place = placeSuggestion(
      {
        properties: {
          housenumber: "350",
          street: "5th Avenue",
          city: "New York",
          state: "New York",
          country: "États-Unis",
          countrycode: "US",
        },
      },
      200,
    );
    expect(place?.primary).toBe("350 5th Avenue");
    expect(place?.label).toBe("350 5th Avenue, New York, New York, États-Unis");
  });

  it("sans doublon, et le libellé tient dans le champ", () => {
    const feature = {
      properties: { name: "Parc La Fontaine", city: "Montréal" },
    };
    expect(placeSuggestions([feature, feature], 200)).toHaveLength(1);
    expect(placeSuggestion(feature, 10)?.label).toBe("Parc La Fo");
    expect(placeSuggestion({ properties: {} }, 200)).toBeNull();
  });

  it("le lien vers les cartes encode le lieu", () => {
    expect(mapsUrl("Parc La Fontaine, Montréal")).toBe(
      "https://www.google.com/maps/search/?api=1&query=Parc%20La%20Fontaine%2C%20Montr%C3%A9al",
    );
  });
});
