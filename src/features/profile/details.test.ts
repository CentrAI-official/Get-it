import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ageOn,
  detailErrors,
  MIN_AGE,
  PROVINCES,
  profileDetailsSchema,
  QC_REGIONS,
} from "./details";

const today = "2026-10-26";
const valid = {
  birthDate: "1995-03-14",
  sex: "female",
  country: "CA",
  province: "QC",
  qcRegion: "montreal",
};

describe("ageOn", () => {
  it("compte les années révolues", () => {
    expect(ageOn("2000-10-26", today)).toBe(26);
    expect(ageOn("2000-10-27", today)).toBe(25);
    expect(ageOn("2000-02-29", "2026-02-28")).toBe(25);
    expect(ageOn("2000-02-29", "2026-03-01")).toBe(26);
  });
});

describe("profileDetailsSchema", () => {
  const schema = profileDetailsSchema(today);

  it("accepte une personne de 16 ans et plus au Québec, avec sa région", () => {
    expect(schema.parse(valid)).toEqual(valid);
  });

  it(`refuse moins de ${MIN_AGE} ans`, () => {
    const result = schema.safeParse({ ...valid, birthDate: "2011-01-01" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(detailErrors(result.error).birthDate).toBe("tooYoung");
    }
    // 16 ans aujourd'hui : accepté
    expect(
      schema.safeParse({ ...valid, birthDate: "2010-10-26" }).success,
    ).toBe(true);
  });

  it("refuse une date à venir ou invalide", () => {
    for (const birthDate of ["2030-01-01", "1899-12-31", "2000-13-01", ""]) {
      const result = schema.safeParse({ ...valid, birthDate });
      expect(result.success).toBe(false);
    }
  });

  it("exige une province ou un État du bon pays", () => {
    const result = schema.safeParse({ ...valid, country: "US" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(detailErrors(result.error).province).toBe("provinceRequired");
    }
    expect(
      schema.safeParse({
        ...valid,
        country: "US",
        province: "NY",
        qcRegion: null,
      }).success,
    ).toBe(true);
  });

  it("exige la région au Québec et l'ignore ailleurs", () => {
    const missing = schema.safeParse({ ...valid, qcRegion: null });
    expect(missing.success).toBe(false);
    if (!missing.success) {
      expect(detailErrors(missing.error).qcRegion).toBe("qcRegionRequired");
    }
    expect(
      schema.parse({ ...valid, province: "ON", qcRegion: "montreal" }).qcRegion,
    ).toBeNull();
    // « En ligne » n'est pas une région du Québec
    expect(schema.safeParse({ ...valid, qcRegion: "online" }).success).toBe(
      false,
    );
  });

  it("n'accepte que deux sexes à la naissance", () => {
    expect(schema.safeParse({ ...valid, sex: "unspecified" }).success).toBe(
      false,
    );
  });

  it("a des codes de provinces et d'États uniques", () => {
    const all = [...PROVINCES.CA, ...PROVINCES.US];
    expect(new Set(all).size).toBe(all.length);
    expect(PROVINCES.CA).toHaveLength(13);
    expect(PROVINCES.US).toHaveLength(51);
  });
});

describe("contraintes de la base", () => {
  const sql = readFileSync(
    "prisma/migrations/20261031120000_profile_details/migration.sql",
    "utf8",
  );
  const listAfter = (marker: string) =>
    [
      ...(sql
        .split(marker)[1]
        ?.split(")")[0]
        ?.matchAll(/'([^']+)'/g) ?? []),
    ].map((match) => match[1]);

  it("reprennent les mêmes provinces, États et régions du Québec", () => {
    expect(listAfter(`"country" = 'CA' AND "province" IN (`)).toEqual([
      ...PROVINCES.CA,
    ]);
    expect(listAfter(`"country" = 'US' AND "province" IN (`)).toEqual([
      ...PROVINCES.US,
    ]);
    expect(listAfter(`"qc_region" IN (`)).toEqual([...QC_REGIONS]);
  });
});
