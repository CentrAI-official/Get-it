import { describe, expect, it } from "vitest";
import {
  catalogueFor,
  planKindOf,
  recipeAllowed,
  refsToCodes,
  resolvePlanRefs,
} from "./catalogue";
import type { DevelopmentPlan } from "./plan";
import { addPlanItem, mealItemName, replacePlanItem } from "./plan-edit";
import { planHref } from "./questionnaires";

const plan: DevelopmentPlan = {
  title: "Plan",
  summary: "",
  highlights: [],
  schedule: [
    {
      weekday: 2,
      moment: null,
      time: null,
      title: "Haut du corps",
      items: [
        { name: "Pompes", detail: "4 × 8", ref: "E1" },
        { name: "Tractions", detail: "3 × 6", ref: null },
      ],
    },
    {
      weekday: 5,
      moment: null,
      time: null,
      title: "Menu du vendredi",
      items: [
        { name: "Souper — Saumon au four", detail: "1 portion", ref: "R9" },
      ],
    },
  ],
  sections: [],
  goal: null,
  habits: [],
  tasks: [],
  caution: "",
};

describe("catalogue envoyé à Get iT AI", () => {
  it("chaque élément a un code court, retraduit en identifiant", () => {
    const { text, codes } = catalogueFor("exercise", [
      {
        id: "id-pompes",
        title: "Pompes",
        tags: ["muscle:chest"],
        minutes: null,
      },
      { id: "id-squat", title: "Squat", tags: ["muscle:quads"], minutes: 5 },
    ]);
    expect(text).toBe(
      'E1: "Pompes" [muscle:chest]\nE2: "Squat" [muscle:quads, 5 min]',
    );
    const resolved = resolvePlanRefs(plan, codes);
    expect(resolved.schedule[0]?.items.map((item) => item.ref)).toEqual([
      "id-pompes",
      null,
    ]);
    // Un code inconnu redevient un élément écrit à la main
    expect(resolved.schedule[1]?.items[0]?.ref).toBeNull();
    // Et l'inverse pour une modification
    expect(refsToCodes(resolved, codes).schedule[0]?.items[0]?.ref).toBe("E1");
  });

  it("recettes : jamais une allergie déclarée, et le régime respecté", () => {
    const peanut = ["allergen:peanuts", "diet:vegan"];
    const salmon = ["allergen:fish"];
    const chicken: string[] = [];
    const tofu = ["diet:vegetarian", "diet:vegan", "allergen:soy"];
    expect(
      recipeAllowed(peanut, { allergies: ["peanuts"], diet: "vegan" }),
    ).toBe(false);
    expect(recipeAllowed(tofu, { allergies: ["peanuts"], diet: "vegan" })).toBe(
      true,
    );
    expect(recipeAllowed(chicken, { diet: "vegetarian" })).toBe(false);
    expect(recipeAllowed(salmon, { diet: "pescatarian" })).toBe(true);
    expect(recipeAllowed(chicken, { diet: "pescatarian" })).toBe(false);
    expect(recipeAllowed(chicken, { diet: "omnivore" })).toBe(true);
  });

  it("le plan qui reçoit chaque type, et son adresse", () => {
    expect(planKindOf("exercise", "physical")).toBe("physical");
    expect(planKindOf("recipe", "physical")).toBe("nutrition");
    expect(planKindOf("tool", "social")).toBe("social");
    expect(planHref("nutrition")).toBe("/services/physical/nutrition");
    expect(planHref("physical")).toBe("/services/physical/training");
  });
});

describe("ajouter et remplacer dans un plan", () => {
  const item = { name: "Squat gobelet", detail: "3 × 12", ref: "id-gobelet" };

  it("ajoute à la séance du jour, ou crée la séance", () => {
    const added = addPlanItem(plan, {
      weekday: 2,
      item,
      sessionTitle: "Séance",
    });
    expect(added.ok && added.plan.schedule[0]?.items.at(-1)).toEqual(item);
    const created = addPlanItem(plan, {
      weekday: 3,
      item,
      sessionTitle: "Séance",
    });
    expect(
      created.ok && created.plan.schedule.map((day) => day.weekday),
    ).toEqual([2, 3, 5]);
    expect(created.ok && created.plan.schedule[1]?.title).toBe("Séance");
  });

  it("refuse un jour invalide ou une journée pleine", () => {
    expect(addPlanItem(plan, { weekday: 8, item, sessionTitle: "S" })).toEqual({
      ok: false,
      error: "invalidDay",
    });
    let full = plan;
    for (let i = 0; i < 8; i++) {
      const next = addPlanItem(full, { weekday: 2, item, sessionTitle: "S" });
      if (next.ok) full = next.plan;
    }
    expect(addPlanItem(full, { weekday: 2, item, sessionTitle: "S" })).toEqual({
      ok: false,
      error: "dayFull",
    });
  });

  it("remplace en gardant les séries, et le repas d'un menu", () => {
    const replaced = replacePlanItem(plan, { weekday: 2, index: 1, item });
    expect(replaced.ok && replaced.plan.schedule[0]?.items[1]).toEqual({
      name: "Squat gobelet",
      detail: "3 × 6",
      ref: "id-gobelet",
    });
    const dish = {
      name: "Tacos de poisson",
      detail: "1 portion",
      ref: "id-tacos",
    };
    const meal = replacePlanItem(plan, { weekday: 5, index: 0, item: dish });
    expect(meal.ok && meal.plan.schedule[1]?.items[0]?.name).toBe(
      mealItemName("Souper", "Tacos de poisson"),
    );
    expect(replacePlanItem(plan, { weekday: 2, index: 5, item })).toEqual({
      ok: false,
      error: "itemMissing",
    });
  });
});
