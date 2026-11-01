import { describe, expect, it } from "vitest";
import { lastDays } from "@/lib/dates";
import { goalPace, regularity } from "./progression";

// 2026-11-04 est un mercredi
const today = "2026-11-04";

describe("régularité", () => {
  it("compte les jours actifs de chaque semaine, du lundi au dimanche", () => {
    const result = regularity(
      ["2026-11-02", "2026-11-04", "2026-11-01", "2026-10-26", "2026-11-05"],
      today,
      "2026-01-01",
    );
    expect(result.weeks).toHaveLength(12);
    expect(result.weeks.at(-1)).toEqual({
      start: "2026-11-02",
      count: 2,
      current: true,
    });
    // Le dimanche 1er novembre et le lundi 26 octobre : semaine précédente
    expect(result.weeks.at(-2)).toMatchObject({
      start: "2026-10-26",
      count: 2,
    });
    expect(result.thisWeek).toBe(2);
  });

  it("un compte récent montre ses semaines depuis l'inscription, 4 au moins", () => {
    expect(regularity([], today, "2026-11-03").weeks).toHaveLength(4);
    expect(regularity([], today, "2026-09-20").weeks).toHaveLength(8);
    expect(regularity([], today, "2025-01-01").weeks).toHaveLength(12);
  });

  it("aujourd'hui pas encore fait ne casse pas la série", () => {
    const days = lastDays("2026-11-03", 4);
    expect(regularity(days, today, "2026-01-01").streak).toBe(4);
    expect(regularity([...days, today], today, "2026-01-01").streak).toBe(5);
    expect(regularity(["2026-11-01"], today, "2026-01-01").streak).toBe(0);
  });

  it("garde le record, même quand la série est finie", () => {
    const old = lastDays("2026-10-10", 12);
    const result = regularity([...old, "2026-11-04"], today, "2026-01-01");
    expect(result.best).toBe(12);
    expect(result.streak).toBe(1);
  });
});

describe("rythme d'un objectif", () => {
  const base = {
    milestonesDone: 2,
    milestonesTotal: 4,
    startedOn: "2026-10-05",
    targetDate: "2026-12-04",
    today,
  };

  it("compare les jalons faits au temps écoulé", () => {
    // 30 jours sur 60 : la moitié du temps, la moitié des jalons
    expect(goalPace(base)).toEqual({
      progress: 0.5,
      elapsed: 0.5,
      daysLeft: 30,
      status: "onTrack",
    });
    // 40 % des jalons pour 50 % du temps : 10 points de retard
    expect(
      goalPace({ ...base, milestonesDone: 2, milestonesTotal: 5 }).status,
    ).toBe("slightlyLate");
    expect(
      goalPace({ ...base, milestonesDone: 1, milestonesTotal: 5 }).status,
    ).toBe("late");
  });

  it("une date passée sans tous les jalons : en retard", () => {
    const past = goalPace({
      ...base,
      milestonesDone: 3,
      targetDate: "2026-11-01",
    });
    expect(past).toMatchObject({ elapsed: 1, daysLeft: -3, status: "late" });
    expect(
      goalPace({ ...base, milestonesDone: 4, targetDate: "2026-11-01" }).status,
    ).toBe("onTrack");
  });

  it("rien à comparer sans jalon ou sans date", () => {
    expect(goalPace({ ...base, targetDate: null })).toEqual({
      progress: 0.5,
      elapsed: null,
      daysLeft: null,
      status: null,
    });
    expect(
      goalPace({ ...base, milestonesDone: 0, milestonesTotal: 0 }),
    ).toMatchObject({ progress: null, daysLeft: 30, status: null });
  });
});
