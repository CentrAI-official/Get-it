import { describe, expect, it } from "vitest";
import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";
import {
  describeSchedule,
  HABIT_ERROR_KEYS,
  habitFieldErrors,
  habitFormSchema,
} from "./schemas";
import { computeStreaks } from "./streak";

const DAILY = [1, 2, 3, 4, 5, 6, 7];
// Semaine du lundi 5 au dimanche 11 octobre 2026
const streak = (
  weekdays: number[],
  done: string[],
  today = "2026-10-11",
  startDay = "2026-10-05",
) => computeStreaks({ weekdays, completions: new Set(done), startDay, today });

describe("computeStreaks", () => {
  it("compte les jours faits d'affilée", () => {
    expect(streak(DAILY, ["2026-10-09", "2026-10-10", "2026-10-11"])).toEqual({
      current: 3,
      best: 3,
    });
  });

  it("ne casse pas la série tant qu'aujourd'hui n'est pas fini", () => {
    expect(streak(DAILY, ["2026-10-09", "2026-10-10"])).toEqual({
      current: 2,
      best: 2,
    });
  });

  it("remet la série à zéro après un jour prévu manqué, en gardant la meilleure", () => {
    expect(
      streak(DAILY, ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-10"]),
    ).toEqual({ current: 1, best: 3 });
  });

  it("ignore les jours non prévus", () => {
    // Lundi, mercredi, vendredi : mardi et jeudi ne cassent rien
    expect(
      streak(
        [1, 3, 5],
        ["2026-10-05", "2026-10-07", "2026-10-09"],
        "2026-10-09",
      ),
    ).toEqual({ current: 3, best: 3 });
  });

  it("compte en bonus un jour non prévu fait quand même", () => {
    expect(
      streak(
        [1, 3, 5],
        ["2026-10-05", "2026-10-06", "2026-10-07"],
        "2026-10-07",
      ),
    ).toEqual({ current: 3, best: 3 });
  });

  it("ne compte rien avant le début de l'habitude", () => {
    expect(streak(DAILY, [], "2026-10-11", "2026-10-11")).toEqual({
      current: 0,
      best: 0,
    });
  });
});

describe("habitFormSchema", () => {
  const valid = {
    locale: "fr",
    title: "  Méditer 10 minutes ",
    pillar: "mental",
    weekdays: "5,1,3,3",
    goalId: "",
  };

  it("nettoie la saisie : titre rogné, jours triés sans doublon, objectif vide → null", () => {
    expect(habitFormSchema.parse(valid)).toEqual({
      locale: "fr",
      title: "Méditer 10 minutes",
      pillar: "mental",
      weekdays: [1, 3, 5],
      goalId: null,
    });
  });

  it("exige au moins un jour valide", () => {
    for (const weekdays of ["", "0", "8", "1,9"]) {
      const result = habitFormSchema.safeParse({ ...valid, weekdays });
      expect(habitFieldErrors(result.error!)).toEqual({
        weekdays: "weekdaysRequired",
      });
    }
  });

  it("refuse un objectif lié qui n'est pas un identifiant", () => {
    expect(habitFormSchema.safeParse({ ...valid, goalId: "abc" }).success).toBe(
      false,
    );
  });
});

describe("describeSchedule", () => {
  it("reconnaît les calendriers courants", () => {
    expect(describeSchedule([7, 6, 5, 4, 3, 2, 1])).toBe("daily");
    expect(describeSchedule([1, 2, 3, 4, 5])).toBe("workweek");
    expect(describeSchedule([6, 7])).toBe("weekend");
    expect(describeSchedule([1, 3, 5])).toBe("custom");
  });
});

describe("messages d'erreur des habitudes", () => {
  it("existent pour chaque erreur, en français et en anglais", () => {
    for (const messages of [fr, en]) {
      expect(Object.keys(messages.Habits.errors).sort()).toEqual(
        [...HABIT_ERROR_KEYS].sort(),
      );
    }
  });
});
