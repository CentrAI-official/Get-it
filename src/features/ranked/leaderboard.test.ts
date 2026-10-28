import { describe, expect, it } from "vitest";
import { leaderboardFiltersSchema, rankEntries } from "./leaderboard";

describe("classement Ranked", () => {
  it("classe par niveau, même rang pour un même niveau", () => {
    const ranked = rankEntries([
      { id: "a", level: 72, evaluatedAt: "2026-10-20T10:00:00.000Z" },
      { id: "b", level: 88, evaluatedAt: "2026-10-21T10:00:00.000Z" },
      { id: "c", level: 72, evaluatedAt: "2026-10-19T10:00:00.000Z" },
      { id: "d", level: 40, evaluatedAt: "2026-10-18T10:00:00.000Z" },
    ]);
    expect(ranked.map((entry) => [entry.id, entry.rank])).toEqual([
      ["b", 1],
      ["c", 2],
      ["a", 2],
      ["d", 4],
    ]);
  });

  it("lit les filtres de l'adresse, avec des valeurs par défaut", () => {
    expect(leaderboardFiltersSchema.parse({})).toEqual({
      pillar: "total",
      scope: "all",
    });
    expect(
      leaderboardFiltersSchema.parse({ pillar: "physical", scope: "contacts" }),
    ).toEqual({ pillar: "physical", scope: "contacts" });
    expect(
      leaderboardFiltersSchema.parse({ pillar: "mental", scope: "x" }),
    ).toEqual({ pillar: "total", scope: "all" });
  });
});
