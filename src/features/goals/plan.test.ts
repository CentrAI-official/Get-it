import { describe, expect, it } from "vitest";
import {
  goalPlanSelectionSchema,
  normalizeGoalPlan,
  PLAN_LIMITS,
  type AiGoalPlan,
} from "./plan";

const raw: AiGoalPlan = {
  summary: "  On commence doucement.  ",
  milestones: [
    { title: "Courir 5 km" },
    { title: "  courir   5 KM " },
    { title: "" },
    { title: "Courir 10 km" },
  ],
  tasks: [
    { title: "Acheter des souliers", dueInDays: -3 },
    { title: "Courir 20 minutes", dueInDays: 2.6 },
    { title: "S'inscrire à une course", dueInDays: 400 },
  ],
  habits: [
    { title: "Étirements", weekdays: [5, 1, 1, 9, 3] },
    { title: "Marcher", weekdays: [] },
  ],
};

describe("normalizeGoalPlan", () => {
  it("nettoie les titres et retire les doublons et les vides", () => {
    const plan = normalizeGoalPlan(raw);
    expect(plan.summary).toBe("On commence doucement.");
    expect(plan.milestones).toEqual([
      { title: "Courir 5 km" },
      { title: "Courir 10 km" },
    ]);
  });

  it("borne les échéances, jamais après la date cible", () => {
    expect(normalizeGoalPlan(raw).tasks.map((t) => t.dueInDays)).toEqual([
      0,
      3,
      PLAN_LIMITS.horizonDays,
    ]);
    expect(
      normalizeGoalPlan(raw, { maxDueInDays: 10 }).tasks.map(
        (t) => t.dueInDays,
      ),
    ).toEqual([0, 3, 10]);
  });

  it("garde des jours de la semaine valides, tous les jours par défaut", () => {
    expect(normalizeGoalPlan(raw).habits).toEqual([
      { title: "Étirements", weekdays: [1, 3, 5] },
      { title: "Marcher", weekdays: [1, 2, 3, 4, 5, 6, 7] },
    ]);
  });

  it("plafonne le nombre d'éléments", () => {
    const plan = normalizeGoalPlan({
      ...raw,
      milestones: Array.from({ length: 12 }, (_, i) => ({
        title: `Jalon ${i}`,
      })),
    });
    expect(plan.milestones).toHaveLength(PLAN_LIMITS.milestones);
  });
});

describe("goalPlanSelectionSchema", () => {
  it("accepte une sélection valide et refuse ce qui sort des limites", () => {
    const valid = {
      milestones: ["Courir 5 km"],
      tasks: [{ title: "Courir 20 minutes", dueInDays: 2 }],
      habits: [{ title: "Étirements", weekdays: [1, 3] }],
    };
    expect(goalPlanSelectionSchema.safeParse(valid).success).toBe(true);
    for (const invalid of [
      { ...valid, milestones: [""] },
      { ...valid, tasks: [{ title: "x", dueInDays: 999 }] },
      { ...valid, habits: [{ title: "x", weekdays: [] }] },
      { ...valid, habits: [{ title: "x", weekdays: [1, 1] }] },
    ]) {
      expect(goalPlanSelectionSchema.safeParse(invalid).success).toBe(false);
    }
  });
});
