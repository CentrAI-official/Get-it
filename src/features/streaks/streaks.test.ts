import { describe, expect, it } from "vitest";
import { lastDays } from "@/lib/dates";
import {
  dayStreak,
  mondayOf,
  streakBefore,
  streakMilestone,
  weekStreak,
} from "./rules";

// 2026-11-04 est un mercredi
const today = "2026-11-04";

describe("série de jours", () => {
  it("aujourd'hui pas encore actif ne casse pas la série", () => {
    const days = lastDays("2026-11-03", 5);
    expect(dayStreak(days, today)).toEqual({ current: 5, best: 5 });
    expect(dayStreak([...days, today], today)).toEqual({ current: 6, best: 6 });
  });

  it("un jour manqué remet la série à zéro, le record reste", () => {
    const old = lastDays("2026-10-20", 9);
    expect(dayStreak([...old, "2026-11-03"], today)).toEqual({
      current: 1,
      best: 9,
    });
    expect(dayStreak(["2026-11-01"], today).current).toBe(0);
  });

  it("compte la série jusqu'à hier, sans aujourd'hui", () => {
    expect(streakBefore([...lastDays("2026-11-03", 3), today], today)).toBe(3);
    expect(streakBefore([today], today)).toBe(0);
  });

  it("ignore les jours après aujourd'hui", () => {
    expect(dayStreak(["2026-11-05", today], today)).toEqual({
      current: 1,
      best: 1,
    });
  });
});

describe("série de semaines", () => {
  it("trouve le lundi de la semaine", () => {
    expect(mondayOf(today)).toBe("2026-11-02");
    expect(mondayOf("2026-11-08")).toBe("2026-11-02");
  });

  it("compte les semaines d'affilée avec au moins un jour actif", () => {
    // Semaines du 19 octobre, du 26 octobre et celle-ci
    const days = ["2026-10-20", "2026-10-31", "2026-11-02"];
    expect(weekStreak(days, today)).toEqual({ current: 3, best: 3 });
  });

  it("la semaine en cours pas encore active ne casse pas la série", () => {
    expect(weekStreak(["2026-10-20", "2026-10-31"], today).current).toBe(2);
    expect(weekStreak(["2026-10-13", "2026-10-31"], today)).toEqual({
      current: 1,
      best: 1,
    });
  });
});

describe("paliers de série", () => {
  it("fête un palier au moment où il est franchi", () => {
    expect(streakMilestone(6, 7)).toBe(7);
    expect(streakMilestone(7, 8)).toBeNull();
    expect(streakMilestone(29, 30)).toBe(30);
    expect(streakMilestone(0, 1)).toBeNull();
  });
});
