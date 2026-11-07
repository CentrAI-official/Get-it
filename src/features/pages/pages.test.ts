import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { REGIONS, SERVICE_CATEGORIES } from "@/features/marketplace/rules";
import {
  handleFromName,
  HANDLE_PATTERN,
  isValidHandle,
  PAGE_LIMITS,
  pageCompletion,
  pageFieldErrors,
  pageFormSchema,
} from "./rules";

const valid = {
  name: "Coach Max Énergie",
  handle: "coach-max",
  category: "fitness_coach",
  about: "  Entraînement en salle et à la maison. ",
  regions: ["montreal", "online", "montreal"],
  website: "https://coachmax.ca",
};

describe("adresse d'une page", () => {
  it("proposée à partir du nom, sans accents ni signes", () => {
    expect(handleFromName("Coach Max Énergie")).toBe("coach-max-energie");
    expect(handleFromName("  L'Atelier — Nutrition!  ")).toBe(
      "l-atelier-nutrition",
    );
    expect(handleFromName("Ab")).toBe("");
    expect(handleFromName("x".repeat(40))).toHaveLength(PAGE_LIMITS.handleMax);
  });

  it("minuscules, chiffres et signes, jamais au début ni à la fin", () => {
    for (const handle of ["coach-max", "max.fit", "nutri_2026", "abc"]) {
      expect(isValidHandle(handle)).toBe(true);
    }
    for (const handle of [
      "ab",
      "-coach",
      "coach.",
      "Coach",
      "coach max",
      "a".repeat(31),
    ]) {
      expect(isValidHandle(handle)).toBe(false);
    }
    // Réservées : elles prêteraient à confusion avec Get iT
    expect(isValidHandle("getit")).toBe(false);
    expect(isValidHandle("new")).toBe(false);
  });
});

describe("formulaire d'une page", () => {
  it("nettoie les champs et retire les régions en double", () => {
    expect(pageFormSchema.parse(valid)).toEqual({
      name: "Coach Max Énergie",
      handle: "coach-max",
      category: "fitness_coach",
      about: "Entraînement en salle et à la maison.",
      regions: ["montreal", "online"],
      website: "https://coachmax.ca",
    });
    expect(
      pageFormSchema.parse({
        ...valid,
        website: "",
        regions: undefined,
        about: undefined,
      }),
    ).toMatchObject({ website: null, regions: [], about: "" });
    // L'adresse se met en minuscules
    expect(pageFormSchema.parse({ ...valid, handle: "Coach-Max" }).handle).toBe(
      "coach-max",
    );
  });

  it("refuse ce qui ne convient pas, champ par champ", () => {
    const result = pageFormSchema.safeParse({
      name: "A",
      handle: "-x",
      category: "plombier",
      about: "x".repeat(PAGE_LIMITS.about + 1),
      regions: ["mars"],
      website: "coachmax",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(pageFieldErrors(result.error)).toEqual({
        name: "nameRequired",
        handle: "handleInvalid",
        category: "categoryRequired",
        about: "aboutTooLong",
        regions: "regionsInvalid",
        website: "websiteInvalid",
      });
    }
    const reserved = pageFormSchema.safeParse({ ...valid, handle: "support" });
    expect(!reserved.success && pageFieldErrors(reserved.error)).toEqual({
      handle: "handleReserved",
    });
  });
});

describe("ce qui manque à une page", () => {
  it("logo, couverture, présentation, premier service", () => {
    expect(
      pageCompletion({
        logoUrl: null,
        coverUrl: "x",
        about: "  ",
        services: 0,
      }),
    ).toEqual({
      steps: [
        { key: "logo", done: false },
        { key: "cover", done: true },
        { key: "about", done: false },
        { key: "service", done: false },
      ],
      done: 1,
    });
    expect(
      pageCompletion({ logoUrl: "a", coverUrl: "b", about: "Moi", services: 2 })
        .done,
    ).toBe(4);
  });
});

describe("migration", () => {
  const sql = readFileSync(
    join(process.cwd(), "prisma/migrations/20261119120000_pages/migration.sql"),
    "utf8",
  );
  const list = (values: readonly string[]) =>
    values.map((value) => `'${value}'`).join(", ");

  it("garde les mêmes listes et limites que les règles", () => {
    expect(sql).toContain(`"handle" ~ '${HANDLE_PATTERN.source}'`);
    expect(sql).toContain(
      `char_length("name") BETWEEN 1 AND ${PAGE_LIMITS.name}`,
    );
    expect(sql).toContain(`char_length("about") <= ${PAGE_LIMITS.about}`);
    expect(sql).toContain(
      `char_length("website") BETWEEN 1 AND ${PAGE_LIMITS.website}`,
    );
    expect(sql).toContain(`"category" IN (${list(SERVICE_CATEGORIES)})`);
    expect(sql).toContain(`ARRAY[${list(REGIONS)}]`);
    expect(sql).toContain('"pages" ENABLE ROW LEVEL SECURITY');
    // Une seule page par personne
    expect(sql).toContain('CREATE UNIQUE INDEX "pages_owner_id_key"');
  });
});
