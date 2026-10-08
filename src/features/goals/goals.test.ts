import { describe, expect, it } from "vitest";
import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";
import { taskFormSchema } from "@/features/tasks/schemas";
import {
  firstGoalError,
  GOAL_ERROR_KEYS,
  goalFieldErrors,
  goalFormSchema,
  milestoneFormSchema,
} from "./schemas";

const validGoal = {
  locale: "fr",
  title: "  Courir un demi-marathon ",
  description: "",
  pillar: "physical",
  targetDate: "",
};

describe("goalFormSchema", () => {
  it("nettoie la saisie : titre rogné, champs facultatifs vides → null", () => {
    expect(goalFormSchema.parse(validGoal)).toEqual({
      locale: "fr",
      title: "Courir un demi-marathon",
      description: null,
      pillar: "physical",
      targetDate: null,
    });
  });

  it("garde une date cible valide", () => {
    const result = goalFormSchema.parse({
      ...validGoal,
      targetDate: "2026-12-31",
    });
    expect(result.targetDate).toBe("2026-12-31");
  });

  it("explique chaque champ refusé", () => {
    const result = goalFormSchema.safeParse({
      ...validGoal,
      title: "x",
      pillar: "",
      targetDate: "2026-02-30",
    });
    expect(result.success).toBe(false);
    expect(goalFieldErrors(result.error!)).toEqual({
      title: "titleRequired",
      pillar: "pillarRequired",
      targetDate: "dateInvalid",
    });
  });

  it("refuse une description trop longue", () => {
    const result = goalFormSchema.safeParse({
      ...validGoal,
      description: "a".repeat(1001),
    });
    expect(goalFieldErrors(result.error!)).toEqual({
      description: "descriptionTooLong",
    });
  });
});

describe("jalons et tâches", () => {
  it("exigent un titre", () => {
    const result = milestoneFormSchema.safeParse({ title: "   " });
    expect(firstGoalError(result.error!)).toBe("titleRequired");
  });

  it("acceptent une tâche sans échéance", () => {
    expect(
      taskFormSchema.parse({ title: "Appeler le club", dueDate: "" }),
    ).toEqual({
      title: "Appeler le club",
      dueDate: null,
    });
  });

  it("refusent une échéance invalide", () => {
    const result = taskFormSchema.safeParse({
      title: "Appeler",
      dueDate: "demain",
    });
    expect(firstGoalError(result.error!)).toBe("dateInvalid");
  });
});

describe("messages d'erreur des objectifs", () => {
  it("existent pour chaque erreur, en français et en anglais", () => {
    for (const messages of [fr, en]) {
      expect(Object.keys(messages.Goals.errors).sort()).toEqual(
        [...GOAL_ERROR_KEYS].sort(),
      );
    }
  });
});
