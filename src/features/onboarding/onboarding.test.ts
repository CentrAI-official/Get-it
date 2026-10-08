import { describe, expect, it } from "vitest";
import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";
import { PILLARS } from "@/config/pillars";
import { GOAL_SUGGESTIONS, MAX_GOALS, onboardingSchema } from "./schemas";

const valid = {
  displayName: "  Max ",
  occupation: "entrepreneur",
  pillars: ["physical", "financial"],
  goals: [
    { title: "Courir 5 km", pillar: "physical" },
    { title: "Économiser 1 000 $", pillar: "financial" },
  ],
  assessments: { physical: 2, financial: 3 },
  dailyMinutes: 30,
};

describe("onboardingSchema", () => {
  it("accepte des réponses complètes et nettoie le prénom", () => {
    const result = onboardingSchema.parse(valid);
    expect(result.displayName).toBe("Max");
  });

  it("accepte une occupation non renseignée", () => {
    expect(
      onboardingSchema.safeParse({ ...valid, occupation: null }).success,
    ).toBe(true);
  });

  it("refuse un objectif rattaché à un pilier non choisi", () => {
    const result = onboardingSchema.safeParse({
      ...valid,
      goals: [{ title: "Méditer", pillar: "mental" }],
    });
    expect(result.success).toBe(false);
  });

  it("exige une évaluation pour chaque pilier choisi, et seulement ceux-là", () => {
    for (const assessments of [
      { physical: 2 },
      { ...valid.assessments, mental: 4 },
    ]) {
      expect(
        onboardingSchema.safeParse({ ...valid, assessments }).success,
      ).toBe(false);
    }
  });

  it("refuse une note hors de 1 à 5", () => {
    const result = onboardingSchema.safeParse({
      ...valid,
      assessments: { physical: 6, financial: 3 },
    });
    expect(result.success).toBe(false);
  });

  it(`limite le nombre d'objectifs à ${MAX_GOALS} et refuse les doublons`, () => {
    const many = Array.from({ length: MAX_GOALS + 1 }, (_, i) => ({
      title: `Objectif ${i}`,
      pillar: "physical" as const,
    }));
    const duplicates = [
      { title: "Courir", pillar: "physical" as const },
      { title: "courir", pillar: "physical" as const },
    ];
    for (const goals of [many, duplicates]) {
      expect(onboardingSchema.safeParse({ ...valid, goals }).success).toBe(
        false,
      );
    }
  });

  it("refuse un temps quotidien qui n'est pas proposé", () => {
    expect(
      onboardingSchema.safeParse({ ...valid, dailyMinutes: 45 }).success,
    ).toBe(false);
  });
});

describe("idées d'objectifs", () => {
  it("existent pour chaque pilier, en français et en anglais", () => {
    for (const messages of [fr, en]) {
      for (const pillar of PILLARS) {
        const texts = messages.Onboarding.goals.suggestions[pillar];
        expect(Object.keys(texts).sort()).toEqual(
          [...GOAL_SUGGESTIONS[pillar]].sort(),
        );
      }
    }
  });
});
