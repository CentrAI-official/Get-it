import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  firstUnseenIndex,
  hasUnseen,
  orderRings,
  STORY_CAPTION_MAX,
  storyExpiry,
  storyInputSchema,
  STORY_TTL_MS,
} from "./rules";

const ring = (id: string, latestAt: string, stories: string[]) => ({
  id,
  latestAt,
  stories: stories.map((story) => ({ id: story })),
});

describe("stories", () => {
  it("met d'abord les personnes avec du nouveau, puis la plus récente", () => {
    const rings = [
      ring("a", "2026-10-27T10:00:00.000Z", ["a1"]),
      ring("b", "2026-10-27T12:00:00.000Z", ["b1"]),
      ring("c", "2026-10-27T08:00:00.000Z", ["c1", "c2"]),
    ];
    const seen = new Set(["b1", "c1"]);
    expect(orderRings(rings, seen).map((r) => r.id)).toEqual(["a", "c", "b"]);
    expect(orderRings(rings, new Set()).map((r) => r.id)).toEqual([
      "b",
      "a",
      "c",
    ]);
  });

  it("ouvre la première story pas encore vue", () => {
    const r = ring("c", "2026-10-27T08:00:00.000Z", ["c1", "c2", "c3"]);
    expect(firstUnseenIndex(r, new Set(["c1"]))).toBe(1);
    expect(firstUnseenIndex(r, new Set(["c1", "c2", "c3"]))).toBe(0);
    expect(hasUnseen(r, new Set(["c1", "c2", "c3"]))).toBe(false);
  });

  it("dure 24 heures", () => {
    const at = new Date("2026-10-27T10:00:00.000Z");
    expect(storyExpiry(at).getTime() - at.getTime()).toBe(STORY_TTL_MS);
  });

  it("demande exactement un média et une légende courte", () => {
    const media = [
      {
        uploadId: "0196f3a2-7b1c-7d2e-8f3a-123456789abc",
        width: 1080,
        height: 1920,
      },
    ];
    expect(storyInputSchema.safeParse({ media, caption: "" }).success).toBe(
      true,
    );
    expect(storyInputSchema.safeParse({ media: [], caption: "" }).success).toBe(
      false,
    );
    expect(
      storyInputSchema.safeParse({ media: [...media, ...media], caption: "" })
        .success,
    ).toBe(false);
    const long = storyInputSchema.safeParse({
      media,
      caption: "a".repeat(STORY_CAPTION_MAX + 1),
    });
    expect(long.success ? null : long.error.issues[0]?.message).toBe(
      "storyCaptionTooLong",
    );
  });

  it("la migration garde les mêmes limites et active le RLS", () => {
    const sql = readFileSync(
      new URL(
        "../../../prisma/migrations/20261101130000_stories/migration.sql",
        import.meta.url,
      ),
      "utf8",
    );
    expect(sql).toContain(`char_length("caption") <= ${STORY_CAPTION_MAX}`);
    expect(sql).toContain('ALTER TABLE "stories" ENABLE ROW LEVEL SECURITY');
  });
});
