import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  LIBRARY_KINDS,
  LIBRARY_STATUSES,
  libraryItemSchema,
  libraryYoutubeSchema,
  matchesFilters,
  parseFilters,
  parseYoutubeUrl,
  tagOf,
  YOUTUBE_CHANNEL_MAX,
  YOUTUBE_MAX_SECONDS,
  youtubeEmbedUrl,
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

describe("démonstration YouTube", () => {
  it("lit les liens courants, et rien d’autre", () => {
    const id = "mKREc_xl_j8";
    for (const link of [
      id,
      `https://www.youtube.com/watch?v=${id}`,
      `https://m.youtube.com/watch?v=${id}&pp=0gcJCf`,
      `youtube.com/watch?v=${id}`,
      `https://youtu.be/${id}?si=abc`,
      `https://www.youtube.com/shorts/${id}`,
      `https://www.youtube-nocookie.com/embed/${id}`,
    ]) {
      expect(parseYoutubeUrl(link)).toEqual({ id, start: null });
    }
    expect(parseYoutubeUrl(`https://youtu.be/${id}?t=90`)).toEqual({
      id,
      start: 90,
    });
    expect(
      parseYoutubeUrl(`https://www.youtube.com/watch?v=${id}&t=1m30s`),
    ).toEqual({ id, start: 90 });
    for (const wrong of [
      "",
      "pas un lien",
      `https://vimeo.com/${id}`,
      `https://evil.example/watch?v=${id}`,
      "https://www.youtube.com/watch?v=trop-court",
      "https://www.youtube.com/@chaine",
    ]) {
      expect(parseYoutubeUrl(wrong)).toBeNull();
    }
  });

  it("un extrait finit après son début", () => {
    const video = { id: "mKREc_xl_j8", start: 10, end: 70 };
    expect(libraryYoutubeSchema.safeParse(video).success).toBe(true);
    expect(libraryYoutubeSchema.safeParse({ ...video, end: 10 }).success).toBe(
      false,
    );
    expect(libraryYoutubeSchema.safeParse({ ...video, id: "x" }).success).toBe(
      false,
    );
  });

  it("lecteur sans témoins, sans suggestions d’autres chaînes", () => {
    const url = new URL(
      youtubeEmbedUrl({ id: "mKREc_xl_j8", start: 5, end: null }),
    );
    expect(url.hostname).toBe("www.youtube-nocookie.com");
    expect(url.pathname).toBe("/embed/mKREc_xl_j8");
    expect(url.searchParams.get("rel")).toBe("0");
    expect(url.searchParams.get("start")).toBe("5");
    expect(url.searchParams.has("end")).toBe(false);
  });

  it("mêmes limites que la migration", () => {
    const sql = readFileSync(
      join(
        process.cwd(),
        "prisma/migrations/20261115120000_library_youtube/migration.sql",
      ),
      "utf8",
    );
    expect(sql).toContain(`BETWEEN 0 AND ${YOUTUBE_MAX_SECONDS}`);
    expect(sql).toContain(`BETWEEN 1 AND ${YOUTUBE_CHANNEL_MAX}`);
    expect(sql).toContain("^[A-Za-z0-9_-]{11}$");
  });
});
