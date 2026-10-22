import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  dollarsToCents,
  GEAR_CATEGORIES,
  inPriceRange,
  listingInputSchema,
  PRICE_RANGES,
  REGIONS,
  SERVICE_CATEGORIES,
  SERVICE_PRICE_UNITS,
} from "./rules";

const UPLOAD = "0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b";

const service = {
  kind: "service",
  category: "fitness_coach",
  pillar: "physical",
  title: "Coaching en musculation",
  summary: "Programme sur mesure et suivi chaque semaine.",
  description: "Dix ans d’expérience en salle, plans adaptés à ton horaire.",
  priceMin: "80",
  priceMax: "120",
  priceUnit: "session",
  regions: ["montreal", "online"],
  licenseNumber: "",
  contactName: "Max Pigeon",
  contactEmail: "max@example.com",
  website: "monsite.ca",
  socialUrl: "",
  media: [],
};

const gear = {
  kind: "gear",
  category: "equipment",
  pillar: "physical",
  title: "Bandes élastiques",
  summary: "Ensemble de 5 bandes, neuf.",
  description: "Cinq résistances, sac de transport inclus. Cueillette à Laval.",
  priceMin: "45",
  contactName: "Max Pigeon",
  contactEmail: "max@example.com",
  website: "",
  socialUrl: "",
  media: [{ uploadId: UPLOAD, width: 800, height: 600 }],
};

describe("dollarsToCents", () => {
  it("accepte le point, la virgule et les montants ronds", () => {
    expect(dollarsToCents("80")).toBe(8000);
    expect(dollarsToCents("79,99")).toBe(7999);
    expect(dollarsToCents(" 1 200.5 ")).toBe(120050);
  });

  it("refuse le reste", () => {
    expect(dollarsToCents("")).toBeNull();
    expect(dollarsToCents("-5")).toBeNull();
    expect(dollarsToCents("12.345")).toBeNull();
    expect(dollarsToCents("abc")).toBeNull();
    expect(dollarsToCents("100001")).toBeNull();
  });
});

describe("inPriceRange", () => {
  const range = (key: string) => {
    const found = PRICE_RANGES.find((item) => item.key === key);
    if (!found) throw new Error(key);
    return found;
  };

  it("une fourchette touche toutes les tranches qu'elle traverse", () => {
    const price = { minCents: 8000, maxCents: 12000 };
    expect(inPriceRange(price, range("under50"))).toBe(false);
    expect(inPriceRange(price, range("from50"))).toBe(true);
    expect(inPriceRange(price, range("from100"))).toBe(true);
    expect(inPriceRange(price, range("over200"))).toBe(false);
  });

  it("un prix unique tombe dans une seule tranche (borne haute exclue)", () => {
    const price = { minCents: 10000, maxCents: null };
    expect(inPriceRange(price, range("from50"))).toBe(false);
    expect(inPriceRange(price, range("from100"))).toBe(true);
  });
});

describe("listingInputSchema", () => {
  it("accepte un service et convertit prix et site", () => {
    const result = listingInputSchema.parse(service);
    expect(result.priceMin).toBe(8000);
    expect(result.kind === "service" && result.priceMax).toBe(12000);
    expect(result.website).toBe("https://monsite.ca");
    expect(result.socialUrl).toBeNull();
  });

  it("accepte du gear avec une photo, sans région", () => {
    const result = listingInputSchema.parse(gear);
    expect(result.kind).toBe("gear");
    expect("regions" in result).toBe(false);
  });

  it("refuse une fourchette à l'envers", () => {
    const result = listingInputSchema.safeParse({
      ...service,
      priceMin: "150",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["priceMax"]);
  });

  it("exige un permis pour une profession réglementée", () => {
    const result = listingInputSchema.safeParse({
      ...service,
      category: "psychologist",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("licenseRequired");
    expect(
      listingInputSchema.safeParse({
        ...service,
        category: "psychologist",
        licenseNumber: "12345-89",
      }).success,
    ).toBe(true);
  });

  it("exige une région pour un service et refuse une vidéo", () => {
    expect(
      listingInputSchema.safeParse({ ...service, regions: [] }).success,
    ).toBe(false);
    expect(
      listingInputSchema.safeParse({
        ...gear,
        media: [
          { uploadId: UPLOAD, width: 800, height: 600, durationMs: 3000 },
        ],
      }).success,
    ).toBe(false);
  });

  it("refuse une catégorie de gear pour un service", () => {
    expect(
      listingInputSchema.safeParse({ ...service, category: "clothing" })
        .success,
    ).toBe(false);
  });
});

describe("contraintes de la base", () => {
  const sql = readFileSync(
    "prisma/migrations/20261022150000_marketplace/migration.sql",
    "utf8",
  );
  const quoted = (value: string) => sql.includes(`'${value}'`);

  it("listent les mêmes catégories, unités et régions que les règles", () => {
    for (const value of [
      ...SERVICE_CATEGORIES,
      ...GEAR_CATEGORIES,
      ...SERVICE_PRICE_UNITS,
      ...REGIONS,
    ]) {
      expect(quoted(value), value).toBe(true);
    }
  });
});
