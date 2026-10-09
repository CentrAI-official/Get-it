import { describe, expect, it } from "vitest";
import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";
import { selectHabitsToday, summarizeDay } from "./day-plan";
import { formatDayStamp } from "./day-stamp";
import { computePillarScores } from "./pillar-scores";
import { CHECK_IN_METRICS, checkInSchema } from "./schemas";

// Jeudi 8 octobre 2026
const today = "2026-10-08";

describe("selectHabitsToday", () => {
  const habit = (weekdays: number[], archived = false) => ({
    weekdays,
    archived,
  });

  it("garde les habitudes prévues aujourd'hui, hors pause", () => {
    const daily = habit([1, 2, 3, 4, 5, 6, 7]);
    const thursday = habit([4]);
    const weekend = habit([6, 7]);
    const paused = habit([4], true);
    expect(
      selectHabitsToday([daily, thursday, weekend, paused], today),
    ).toEqual([daily, thursday]);
  });
});

describe("summarizeDay", () => {
  it("compte le jour et chaque pilier, sans les tâches en retard", () => {
    const { day, pillars } = summarizeDay([
      { pillar: "physical", done: true, late: false },
      { pillar: "physical", done: false, late: false },
      { pillar: "mental", done: true, late: false },
      // Sans objectif : dans le total seulement
      { pillar: null, done: false, late: false },
      // En retard : affichée à part, hors du total
      { pillar: "social", done: false, late: true },
    ]);
    expect(day).toEqual({ done: 2, total: 4 });
    expect(pillars).toEqual({
      physical: { done: 1, total: 2 },
      mental: { done: 1, total: 1 },
      social: { done: 0, total: 0 },
      financial: { done: 0, total: 0 },
    });
  });

  it("donne un total nul quand rien n'est prévu", () => {
    expect(summarizeDay([]).day).toEqual({ done: 0, total: 0 });
  });
});

describe("computePillarScores", () => {
  const daily = [1, 2, 3, 4, 5, 6, 7];
  const habit = (completions: string[], extra = {}) => ({
    pillar: "physical" as const,
    weekdays: daily,
    archived: false,
    startDay: "2026-09-01",
    completions,
    ...extra,
  });
  // Fenêtre : du jeudi 1er au mercredi 7 octobre
  const week = [
    "2026-10-01",
    "2026-10-02",
    "2026-10-03",
    "2026-10-04",
    "2026-10-05",
    "2026-10-06",
    "2026-10-07",
  ];

  it("combine l'autoévaluation (40 %) et la régularité des 7 derniers jours (60 %)", () => {
    const scores = computePillarScores({
      habits: [habit(week.slice(0, 7))],
      tasks: [],
      assessments: [{ pillar: "physical", score: 3 }],
      today,
    });
    // 0,4 × 3/5 + 0,6 × 7/7
    expect(scores.physical).toBe(84);
  });

  it("ignore aujourd'hui, les jours hors fenêtre et ceux avant la création", () => {
    const scores = computePillarScores({
      habits: [
        habit([today, "2026-09-30", "2026-10-07"], { startDay: "2026-10-06" }),
      ],
      tasks: [],
      assessments: [],
      today,
    });
    // Prévue le 6 et le 7 seulement, faite le 7
    expect(scores.physical).toBe(50);
  });

  it("compte les tâches d'objectifs dues dans la fenêtre", () => {
    const scores = computePillarScores({
      habits: [],
      tasks: [
        { pillar: "financial", dueDate: "2026-10-02", done: true },
        { pillar: "financial", dueDate: "2026-10-07", done: false },
        { pillar: "financial", dueDate: today, done: false },
        { pillar: "financial", dueDate: "2026-09-30", done: false },
      ],
      assessments: [],
      today,
    });
    expect(scores.financial).toBe(50);
  });

  it("ne compte que les jours prévus et ignore les habitudes en pause", () => {
    const scores = computePillarScores({
      habits: [
        // Lundi et mercredi : prévue le 5 et le 7, faite le 5
        habit(["2026-10-05", "2026-10-06"], { weekdays: [1, 3] }),
        habit([], { archived: true }),
      ],
      tasks: [],
      assessments: [],
      today,
    });
    expect(scores.physical).toBe(50);
  });

  it("utilise l'autoévaluation seule sans activité, et null sans rien", () => {
    const scores = computePillarScores({
      habits: [],
      tasks: [],
      assessments: [{ pillar: "mental", score: 4 }],
      today,
    });
    expect(scores).toEqual({
      physical: null,
      mental: 80,
      social: null,
      financial: null,
    });
  });
});

describe("formatDayStamp", () => {
  // Jeudi 8 octobre, 23 h 30 à Montréal : déjà le 9 en UTC
  const date = new Date("2026-10-09T03:30:00Z");

  it("affiche le jour de l'utilisateur, en majuscules, sans point d'abréviation", () => {
    expect(formatDayStamp(date, "fr", "America/Toronto")).toBe("JEU · 08 OCT");
    expect(formatDayStamp(date, "en", "America/Toronto")).toBe("THU · 08 OCT");
    expect(formatDayStamp(date, "fr", "UTC")).toBe("VEN · 09 OCT");
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
