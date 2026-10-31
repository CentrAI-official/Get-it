import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  MUSIC_ARTIST_MAX,
  MUSIC_CLIP_MS,
  MUSIC_LICENSE_MAX,
  MUSIC_MAX_BYTES,
  MUSIC_MAX_MS,
  MUSIC_MIN_MS,
  MUSIC_MOODS_MAX,
  MUSIC_TITLE_MAX,
  MUSIC_TYPES,
  clampClipStart,
  parseMoods,
  rankForYou,
  rankTrending,
} from "./music";
import { imageDuration, storyInputSchema } from "./rules";
import {
  STORY_ANSWER_MAX,
  freeSpot,
  interactiveOf,
  pollPercents,
  readOverlays,
  storyOverlaysSchema,
  type StoryOverlay,
} from "./studio";

const at = { x: 0.5, y: 0.4, scale: 1, rotation: 0 };
const text: StoryOverlay = {
  ...at,
  id: "t1",
  kind: "text",
  text: "Jour 14",
  font: "strong",
  color: "#ff6b00",
  background: "none",
  align: "center",
  size: 0.08,
};
const poll: StoryOverlay = {
  ...at,
  id: "p1",
  kind: "poll",
  question: "Course ou vélo?",
  options: ["Course", "Vélo"],
};
const media = [
  {
    uploadId: "0192c1f0-0000-7000-8000-000000000001",
    path: "posts/u/a.jpg",
    kind: "image",
    width: 1080,
    height: 1920,
  },
];

describe("éléments d'une story", () => {
  it("place chaque nouvel élément loin des autres, le premier au centre", () => {
    expect(freeSpot([])).toEqual({ x: 0.5, y: 0.5 });
    const second = freeSpot([{ x: 0.5, y: 0.5 }]);
    expect(second).not.toEqual({ x: 0.5, y: 0.5 });
    const placed = [{ x: 0.5, y: 0.5 }, second];
    const third = freeSpot(placed);
    expect(placed).not.toContainEqual(third);
  });

  it("accepte textes, emoji et stickers placés", () => {
    const result = storyOverlaysSchema.safeParse([
      text,
      { ...at, id: "e1", kind: "emoji", emoji: "🔥" },
      { ...at, id: "h1", kind: "hashtag", text: "jour_14" },
      { ...at, id: "l1", kind: "location", text: "Parc Jarry" },
      poll,
    ]);
    expect(result.success).toBe(true);
  });

  it("refuse un emoji qui n'en est pas un, une position hors cadre, deux stickers interactifs", () => {
    expect(
      storyOverlaysSchema.safeParse([
        { ...at, id: "e", kind: "emoji", emoji: "abc" },
      ]).success,
    ).toBe(false);
    expect(storyOverlaysSchema.safeParse([{ ...text, x: 1.2 }]).success).toBe(
      false,
    );
    expect(
      storyOverlaysSchema.safeParse([
        poll,
        { ...at, id: "q", kind: "question", prompt: "Pose-moi une question" },
      ]).success,
    ).toBe(false);
    // Deux éléments ne partagent jamais le même identifiant
    expect(storyOverlaysSchema.safeParse([text, text]).success).toBe(false);
  });

  it("relit les éléments enregistrés en ignorant ceux qui ne sont plus valides", () => {
    expect(readOverlays([text, { kind: "inconnu" }, "x"])).toEqual([text]);
    expect(readOverlays(null)).toEqual([]);
    expect(interactiveOf(readOverlays([text, poll]))?.kind).toBe("poll");
  });

  it("calcule les pourcentages d'un sondage", () => {
    expect(pollPercents([0, 0])).toEqual([0, 0]);
    expect(pollPercents([1, 2])).toEqual([33, 67]);
    expect(pollPercents([3, 0])).toEqual([100, 0]);
  });

  it("n'accepte l'étiquette de musique qu'avec une musique", () => {
    const music = { ...at, id: "m", kind: "music" };
    expect(
      storyInputSchema.safeParse({ media, overlays: [music], music: null })
        .success,
    ).toBe(false);
    expect(
      storyInputSchema.safeParse({
        media,
        overlays: [music],
        music: {
          trackId: "0192c1f0-0000-7000-8000-000000000002",
          startMs: 30_000,
        },
      }).success,
    ).toBe(true);
    // Les anciennes stories (sans studio) restent valides
    expect(
      storyInputSchema.parse({ media, caption: "Salut" }).overlays,
    ).toEqual([]);
    expect(STORY_ANSWER_MAX).toBe(200);
  });
});

describe("musique", () => {
  it("garde l'extrait de 15 s dans le morceau", () => {
    expect(clampClipStart(170_000, 180_000)).toBe(180_000 - MUSIC_CLIP_MS);
    expect(clampClipStart(-5, 60_000)).toBe(0);
    expect(imageDuration(true)).toBe(MUSIC_CLIP_MS);
    expect(imageDuration(false)).toBe(5000);
  });

  it("nettoie les ambiances", () => {
    expect(parseMoods(" Lo-fi, Motivation , lo-fi,,")).toEqual([
      "lo-fi",
      "motivation",
    ]);
    expect(parseMoods("a,b,c,d,e,f,g,h,i,j")).toHaveLength(MUSIC_MOODS_MAX);
  });

  it("classe les tendances et « Pour toi »", () => {
    const tracks = [
      { id: "a", pillars: ["physical" as const], createdAt: "2026-10-01" },
      { id: "b", pillars: ["mental" as const], createdAt: "2026-10-05" },
      { id: "c", pillars: [], createdAt: "2026-10-09" },
    ];
    expect(
      rankTrending(
        tracks,
        new Map([
          ["a", 4],
          ["b", 9],
        ]),
      ).map((t) => t.id),
    ).toEqual(["b", "a", "c"]);
    expect(
      rankForYou(tracks, {
        pillars: ["mental"],
        contactUses: new Map(),
        mine: new Set(),
      }).map((t) => t.id),
    ).toEqual(["b", "c", "a"]);
  });

  it("garde les mêmes limites que la migration", () => {
    const sql = readFileSync(
      join(
        process.cwd(),
        "prisma/migrations/20261106120100_story_studio/migration.sql",
      ),
      "utf8",
    );
    expect(sql).toContain(`"title") BETWEEN 1 AND ${MUSIC_TITLE_MAX}`);
    expect(sql).toContain(`"artist") BETWEEN 1 AND ${MUSIC_ARTIST_MAX}`);
    expect(sql).toContain(`"license") BETWEEN 1 AND ${MUSIC_LICENSE_MAX}`);
    expect(sql).toContain(`cardinality("moods") <= ${MUSIC_MOODS_MAX}`);
    expect(sql).toContain(
      `"duration_ms" BETWEEN ${MUSIC_MIN_MS} AND ${MUSIC_MAX_MS}`,
    );
    expect(sql).toContain(`"size_bytes" BETWEEN 1 AND ${MUSIC_MAX_BYTES}`);
    expect(sql).toContain(`BETWEEN 1 AND ${STORY_ANSWER_MAX}`);
  });

  it("le compartiment accepte chaque type audio du catalogue", () => {
    const sql = readFileSync(
      join(
        process.cwd(),
        "prisma/migrations/20261106120200_music_bucket_types/migration.sql",
      ),
      "utf8",
    );
    for (const type of Object.keys(MUSIC_TYPES))
      expect(sql).toContain(`'${type}'`);
  });
});
