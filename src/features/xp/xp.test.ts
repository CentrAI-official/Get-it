import { describe, expect, it } from "vitest";
import { habitDayXp, levelFromXp, totalXpForLevel, XP_REWARDS } from "./rules";

describe("levelFromXp", () => {
  it("commence au niveau 1 avec 0 XP", () => {
    expect(levelFromXp(0)).toEqual({
      level: 1,
      current: 0,
      needed: 100,
      progress: 0,
    });
  });

  it("passe au niveau suivant pile au seuil (100 × niveau)", () => {
    expect(levelFromXp(99).level).toBe(1);
    expect(levelFromXp(100)).toMatchObject({
      level: 2,
      current: 0,
      needed: 200,
    });
    expect(levelFromXp(299).level).toBe(2);
    expect(levelFromXp(300).level).toBe(3);
  });

  it("donne l'avancement dans le niveau", () => {
    // Niveau 5 à partir de 1 000 XP ; 500 XP pour atteindre le 6
    expect(levelFromXp(1250)).toEqual({
      level: 5,
      current: 250,
      needed: 500,
      progress: 0.5,
    });
  });

  it("reste cohérent sur de grandes valeurs", () => {
    for (const level of [10, 20, 50, 100]) {
      expect(levelFromXp(totalXpForLevel(level)).level).toBe(level);
      expect(levelFromXp(totalXpForLevel(level) - 1).level).toBe(level - 1);
    }
  });

  it("ignore une valeur négative", () => {
    expect(levelFromXp(-20).level).toBe(1);
  });
});

describe("habitDayXp", () => {
  // Jeudi 8 octobre 2026
  const thursday = "2026-10-08";

  it("donne plus d'XP un jour prévu qu'un jour bonus", () => {
    expect(habitDayXp([4], thursday)).toBe(XP_REWARDS.habitScheduled);
    expect(habitDayXp([1, 3], thursday)).toBe(XP_REWARDS.habitBonus);
  });
});
