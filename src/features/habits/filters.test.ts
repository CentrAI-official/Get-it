import { describe, expect, it } from "vitest";
import { arrangeHabits, countByPillar } from "./filters";

const habits = [
  { id: "a", pillar: "physical", startDay: "2026-09-01" },
  { id: "b", pillar: "mental", startDay: "2026-10-01" },
  { id: "c", pillar: "physical", startDay: "2026-10-01" },
  { id: "d", pillar: "financial", startDay: "2026-08-15" },
] as const;

const ids = (list: readonly { id: string }[]) => list.map((item) => item.id);

describe("arrangeHabits", () => {
  it("trie de la plus ancienne à la plus récente, l'ordre reçu départage", () => {
    expect(ids(arrangeHabits([...habits], "all", "oldest"))).toEqual([
      "d",
      "a",
      "b",
      "c",
    ]);
  });

  it("inverse l'ordre pour les plus récentes", () => {
    expect(ids(arrangeHabits([...habits], "all", "newest"))).toEqual([
      "c",
      "b",
      "a",
      "d",
    ]);
  });

  it("garde seulement le pilier choisi", () => {
    expect(ids(arrangeHabits([...habits], "physical", "newest"))).toEqual([
      "c",
      "a",
    ]);
    expect(arrangeHabits([...habits], "social", "oldest")).toEqual([]);
  });

  it("ne modifie pas la liste reçue", () => {
    const list = [...habits];
    arrangeHabits(list, "all", "newest");
    expect(ids(list)).toEqual(["a", "b", "c", "d"]);
  });
});

describe("countByPillar", () => {
  it("compte les habitudes de chaque pilier présent", () => {
    const counts = countByPillar([...habits]);
    expect(counts.get("physical")).toBe(2);
    expect(counts.get("mental")).toBe(1);
    expect(counts.has("social")).toBe(false);
  });
});
