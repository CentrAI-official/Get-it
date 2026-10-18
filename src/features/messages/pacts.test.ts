import { describe, expect, it } from "vitest";
import {
  pactNeed,
  pactOutcome,
  pactProgress,
  pactProposalSchema,
  pactResponseSchema,
} from "./pacts";

const habitId = "0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b";

describe("pactNeed", () => {
  it("« Chaque jour » : tous les jours ; « 80 % » : arrondi au-dessus", () => {
    expect(pactNeed(14, "daily")).toBe(14);
    expect(pactNeed(14, "most")).toBe(12);
    expect(pactNeed(7, "most")).toBe(6);
    expect(pactNeed(30, "most")).toBe(24);
  });
});

describe("pactProgress", () => {
  const startsOn = "2026-10-18";

  it("compte les jours de chacun, ensemble, et le jour du pacte", () => {
    const progress = pactProgress({
      startsOn,
      days: 14,
      today: "2026-10-22",
      mine: new Set(["2026-10-18", "2026-10-19", "2026-10-20", "2026-10-21"]),
      theirs: new Set([
        "2026-10-18",
        "2026-10-19",
        "2026-10-20",
        "2026-10-21",
        "2026-10-22",
      ]),
    });
    expect(progress.dayIndex).toBe(5);
    expect(progress.together).toBe(4);
    expect(progress.mineCount).toBe(4);
    expect(progress.theirsCount).toBe(5);
    expect(progress.meToday).toBe(false);
    expect(progress.themToday).toBe(true);
    expect(progress.cells).toHaveLength(14);
    expect(progress.cells[4]?.state).toBe("today");
    expect(progress.cells[5]?.state).toBe("future");
  });

  it("aujourd'hui pas encore fait ne casse pas la série commune, un jour manqué si", () => {
    const both = new Set(["2026-10-18", "2026-10-20", "2026-10-21"]);
    const progress = pactProgress({
      startsOn,
      days: 7,
      today: "2026-10-22",
      mine: both,
      theirs: both,
    });
    // Le 19 manqué : la série repart du 20
    expect(progress.streak).toBe(2);
  });

  it("avant le début, le pacte est au jour 0", () => {
    const progress = pactProgress({
      startsOn,
      days: 7,
      today: "2026-10-17",
      mine: new Set(),
      theirs: new Set(),
    });
    expect(progress.dayIndex).toBe(0);
    expect(progress.together).toBe(0);
    expect(progress.cells.every((cell) => cell.state === "future")).toBe(true);
  });
});

describe("pactOutcome", () => {
  it("réussi seulement si chacun a fait assez de jours", () => {
    expect(pactOutcome({ need: 12, mineCount: 14, theirsCount: 13 })).toBe(
      "success",
    );
    expect(pactOutcome({ need: 12, mineCount: 14, theirsCount: 11 })).toBe(
      "failed",
    );
  });
});

describe("schémas des pactes", () => {
  it("valide une proposition : durée connue, habitude, titre court", () => {
    expect(
      pactProposalSchema.parse({
        title: "  Méditer 10 minutes ",
        days: 14,
        rule: "most",
        habitId,
      }),
    ).toEqual({ title: "Méditer 10 minutes", days: 14, rule: "most", habitId });
    expect(
      pactProposalSchema.safeParse({
        title: "Yoga",
        days: 10,
        rule: "most",
        habitId,
      }).success,
    ).toBe(false);
    expect(
      pactProposalSchema.safeParse({
        title: "",
        days: 7,
        rule: "daily",
        habitId,
      }).error?.issues[0]?.message,
    ).toBe("titleRequired");
  });

  it("accepter demande une habitude (existante ou nouvelle), refuser non", () => {
    expect(pactResponseSchema.safeParse({ accept: false }).success).toBe(true);
    expect(
      pactResponseSchema.safeParse({ accept: true, habit: { kind: "new" } })
        .success,
    ).toBe(true);
    expect(pactResponseSchema.safeParse({ accept: true }).success).toBe(false);
  });
});
