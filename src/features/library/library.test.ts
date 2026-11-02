import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  LIBRARY_KINDS,
  LIBRARY_STATUSES,
  libraryItemSchema,
  matchesFilters,
  parseFilters,
  tagOf,
} from "./rules";
import { SEED_ITEMS } from "./seed";

describe("filtres du catalogue", () => {
  it("lit les filtres de l'adresse et ignore les valeurs inconnues", () => {
    expect(
      parseFilters("exercise", {
        muscle: "chest,back,wings",
        place: "home",
        q: "  pompes ",
      }),
    ).toEqual({
      include: { muscle: ["chest", "back"], place: ["home"] },
      without: [],
      q: "pompes",
    });
  });

  it("une famille : au moins une valeur ; plusieurs familles : toutes", () => {
    const tags = [tagOf("muscle", "chest"), tagOf("place", "gym")];
    const filters = parseFilters("exercise", { muscle: "chest,back" });
    expect(matchesFilters(tags, filters)).toBe(true);
    expect(
      matchesFilters(
        tags,
        parseFilters("exercise", { muscle: "chest", place: "home" }),
      ),
    ).toBe(false);
  });

  it("recettes : « sans » exclut celles qui contiennent l'allergène", () => {
    const tags = [tagOf("meal", "lunch"), tagOf("allergen", "peanuts")];
    expect(
      matchesFilters(tags, parseFilters("recipe", { sans: "peanuts" })),
    ).toBe(false);
    expect(matchesFilters(tags, parseFilters("recipe", { sans: "milk" }))).toBe(
      true,
    );
    // Le filtre d'inclusion « allergen » n'existe pas pour les membres
    expect(parseFilters("recipe", { allergen: "peanuts" }).include).toEqual({});
  });

  it("outils : les thèmes du pilier seulement", () => {
    expect(
      parseFilters("tool", { theme: "stress,networking" }, "mental").include,
    ).toEqual({ theme: ["stress"] });
  });
});

describe("contenu de départ", () => {
  it("40 exercices, 30 recettes et 20 outils, tous valides", () => {
    const count = (kind: string) =>
      SEED_ITEMS.filter((item) => item.kind === kind).length;
    expect([count("exercise"), count("recipe"), count("tool")]).toEqual([
      40, 30, 20,
    ]);
    for (const item of SEED_ITEMS) {
      const parsed = libraryItemSchema.safeParse(item);
      expect(parsed.success, item.seedKey).toBe(true);
    }
  });

  it("chaque fiche a une clé unique, des étapes et des étiquettes", () => {
    const keys = SEED_ITEMS.map((item) => item.seedKey);
    expect(new Set(keys).size).toBe(keys.length);
    for (const item of SEED_ITEMS) {
      expect(item.content.fr.steps.length, item.seedKey).toBeGreaterThan(1);
      expect(item.tags.length, item.seedKey).toBeGreaterThan(0);
    }
  });

  it("chaque exercice a des consignes de forme ; chaque recette ses ingrédients", () => {
    for (const item of SEED_ITEMS) {
      if (item.kind === "exercise") {
        expect(item.content.fr.cues.length, item.seedKey).toBeGreaterThan(0);
        expect(item.content.fr.mistakes.length, item.seedKey).toBeGreaterThan(
          0,
        );
      }
      if (item.kind === "recipe") {
        expect(
          item.content.fr.ingredients.length,
          item.seedKey,
        ).toBeGreaterThan(1);
        expect(item.servings, item.seedKey).not.toBeNull();
      }
    }
  });

  it("allergènes : la sauce soya, le beurre d'arachide et le tahini sont signalés", () => {
    const contains = (word: RegExp, allergen: string) =>
      SEED_ITEMS.filter(
        (item) =>
          item.kind === "recipe" &&
          item.content.fr.ingredients.some((line) => word.test(line)),
      ).every((item) => item.tags.includes(tagOf("allergen", allergen)));
    expect(contains(/sauce soya/i, "soy")).toBe(true);
    expect(contains(/sauce soya/i, "wheat")).toBe(true);
    expect(contains(/arachide/i, "peanuts")).toBe(true);
    expect(contains(/tahini|sésame/i, "sesame")).toBe(true);
    expect(contains(/avoine|granola/i, "wheat")).toBe(true);
    // « 2 œufs », pas « bœuf »
    expect(contains(/\d+ œufs?(\s|$)|mayonnaise/i, "eggs")).toBe(true);
    // Le lait de vache et le beurre, pas le lait de coco ni le beurre d'arachide
    expect(
      contains(/de lait$|yogourt|fromage|feta|parmesan|de beurre$/i, "milk"),
    ).toBe(true);
  });
});

describe("migration", () => {
  it("les contraintes suivent les listes et le RLS est activé", () => {
    const sql = readFileSync(
      join(
        process.cwd(),
        "prisma/migrations/20261112120000_library/migration.sql",
      ),
      "utf8",
    );
    const list = (values: readonly string[]) =>
      values.map((value) => `'${value}'`).join(", ");
    expect(sql).toContain(`"kind" IN (${list(LIBRARY_KINDS)})`);
    expect(sql).toContain(`"status" IN (${list(LIBRARY_STATUSES)})`);
    expect(sql).toContain(
      'ALTER TABLE "library_items" ENABLE ROW LEVEL SECURITY',
    );
  });
});
