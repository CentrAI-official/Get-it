import { describe, expect, it } from "vitest";
import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";
import { getDayPlan } from "./day-plan";
import { CHECK_IN_METRICS, checkInSchema } from "./schemas";

// Jeudi 8 octobre 2026
const today = "2026-10-08";
const habit = (
  weekdays: number[],
  completions: string[] = [],
  archived = false,
) => ({
  weekdays,
  completions,
  archived,
});

describe("getDayPlan", () => {
  it("garde les habitudes prévues aujourd'hui, hors pause", () => {
    const daily = habit([1, 2, 3, 4, 5, 6, 7]);
    const thursday = habit([4]);
    const weekend = habit([6, 7]);
    const paused = habit([4], [], true);
    const { habitsToday } = getDayPlan({
      habits: [daily, thursday, weekend, paused],
      tasks: [],
      today,
    });
    expect(habitsToday).toEqual([daily, thursday]);
  });

  it("compte les habitudes prévues et les tâches dues aujourd'hui", () => {
    const { progress } = getDayPlan({
      habits: [habit([4], [today]), habit([4], ["2026-10-07"])],
      tasks: [
        { dueDate: today, done: true },
        { dueDate: today, done: false },
        // En retard : affichée à part, hors du total
        { dueDate: "2026-10-01", done: false },
      ],
      today,
    });
    expect(progress).toEqual({ done: 2, total: 4 });
  });

  it("donne un total nul quand rien n'est prévu", () => {
    expect(getDayPlan({ habits: [], tasks: [], today }).progress).toEqual({
      done: 0,
      total: 0,
    });
  });
});

describe("checkInSchema", () => {
  it("accepte quatre notes de 1 à 5 venues d'un formulaire", () => {
    expect(
      checkInSchema.parse({ mood: "4", energy: "3", stress: "2", sleep: "5" }),
    ).toEqual({ mood: 4, energy: 3, stress: 2, sleep: 5 });
  });

  it("refuse une note manquante ou hors de 1 à 5", () => {
    for (const values of [
      { mood: "4", energy: "3", stress: "2" },
      { mood: "0", energy: "3", stress: "2", sleep: "5" },
      { mood: "6", energy: "3", stress: "2", sleep: "5" },
    ]) {
      expect(checkInSchema.safeParse(values).success).toBe(false);
    }
  });

  it("a un libellé et des bornes pour chaque mesure, en français et en anglais", () => {
    for (const messages of [fr, en]) {
      for (const metric of CHECK_IN_METRICS) {
        expect(messages.Today.checkIn.metrics[metric]).toBeTruthy();
        expect(messages.Today.checkIn.low[metric]).toBeTruthy();
        expect(messages.Today.checkIn.high[metric]).toBeTruthy();
      }
    }
  });
});
