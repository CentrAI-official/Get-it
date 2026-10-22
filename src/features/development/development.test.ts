import { describe, expect, it } from "vitest";
import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";
import {
  DEVELOPMENT_PLAN_LIMITS,
  normalizeDevelopmentPlan,
  type AiDevelopmentPlan,
} from "./plan";
import { developmentInstructions, developmentPrompt } from "./prompts";
import {
  allFields,
  DEVELOPMENT_KINDS,
  parseAnswers,
  QUESTIONNAIRES,
} from "./questionnaires";

const TODAY = "2026-10-22";

const physical = {
  fitness: "beginner",
  mainGoal: "lose_fat",
  targetDate: "2027-03-01",
  height: { unit: "cm", cm: 178 },
  weight: { value: 82.5, unit: "kg" },
  sessionsNow: 1,
  sessionsWanted: 4,
  sessionLength: "m45",
  focus: "hybrid",
  equipment: ["gym", "free_weights"],
  breakfast: "  Céréales et café  ",
};

describe("parseAnswers", () => {
  it("accepte un questionnaire complet et nettoie les textes", () => {
    const result = parseAnswers("physical", physical, TODAY);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.answers.breakfast).toBe("Céréales et café");
    expect(result.answers.weight).toEqual({ value: 82.5, unit: "kg" });
  });

  it("signale les réponses obligatoires manquantes", () => {
    const result = parseAnswers(
      "physical",
      { ...physical, focus: undefined },
      TODAY,
    );
    expect(result).toEqual({ ok: false, fields: { focus: "required" } });
  });

  it("refuse une date passée, une option inconnue et une taille impossible", () => {
    const result = parseAnswers(
      "physical",
      {
        ...physical,
        targetDate: "2026-01-01",
        focus: "yoga",
        height: { unit: "cm", cm: 20 },
      },
      TODAY,
    );
    expect(result).toEqual({
      ok: false,
      fields: { targetDate: "invalid", focus: "invalid", height: "invalid" },
    });
  });

  it("accepte la taille en pieds et pouces, le poids en livres", () => {
    const result = parseAnswers(
      "physical",
      {
        ...physical,
        height: { unit: "ft", ft: 5, in: 10 },
        weight: { value: 180, unit: "lb" },
      },
      TODAY,
    );
    expect(result.ok && result.answers.height).toEqual({
      unit: "ft",
      ft: 5,
      in: 10,
    });
  });

  it("exige la précision de « Autre »", () => {
    const result = parseAnswers(
      "physical",
      { ...physical, mainGoal: "other" },
      TODAY,
    );
    expect(result).toEqual({
      ok: false,
      fields: { mainGoalOther: "required" },
    });
    const ok = parseAnswers(
      "physical",
      { ...physical, mainGoal: "other", mainGoalOther: "Courir un marathon" },
      TODAY,
    );
    expect(ok.ok && ok.answers.mainGoalOther).toBe("Courir un marathon");
  });

  it("garde seulement la question ouverte qui suit l'objectif choisi", () => {
    const result = parseAnswers(
      "mental",
      {
        mainGoal: "stress",
        stressDetail: "Les examens",
        focusDetail: "Ignorée : l'objectif n'est pas la concentration",
        challenges: ["overthinking"],
        stressLevel: 4,
        sleepHours: 6.5,
        minutesPerDay: "m10",
        style: "guided",
      },
      TODAY,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.answers.stressDetail).toBe("Les examens");
    expect(result.answers.focusDetail).toBeUndefined();
  });

  it("demande le montant des dettes seulement s'il y en a", () => {
    const base = {
      career: "employee",
      income: 55000,
      mainGoal: "Acheter une maison",
      monthlyExpenses: 2800,
      savings: 4000,
      belt: 3,
      business: "none",
    };
    expect(
      parseAnswers("financial", { ...base, hasDebt: false }, TODAY).ok,
    ).toBe(true);
    expect(
      parseAnswers("financial", { ...base, hasDebt: true }, TODAY),
    ).toEqual({
      ok: false,
      fields: { debtAmount: "required" },
    });
  });
});

const rawPlan = (
  overrides: Partial<AiDevelopmentPlan> = {},
): AiDevelopmentPlan => ({
  crisis: false,
  title: "Plan  remise   en forme",
  summary: "Résumé.",
  highlights: [{ label: "Séances", value: "4" }],
  schedule: [
    {
      weekday: 3,
      title: "Jambes",
      items: [{ name: "Squats", detail: "4 × 8" }],
    },
    {
      weekday: 1,
      title: "Haut",
      items: [{ name: "Pompes", detail: "3 × 10" }],
    },
    { weekday: 1, title: "Doublon", items: [] },
    { weekday: 9, title: "Jour invalide", items: [] },
  ],
  sections: [
    {
      title: "Alimentation",
      items: [{ title: "Protéines", detail: "À chaque repas." }],
    },
  ],
  goal: { title: "Perdre 5 kg", targetInDays: 2 },
  habits: Array.from({ length: 5 }, (_, index) => ({
    title: `Habitude ${index}`,
    weekdays: [8, 2, 2],
  })),
  tasks: [{ title: "Acheter des espadrilles", dueInDays: 90 }],
  caution: "",
  ...overrides,
});

describe("normalizeDevelopmentPlan", () => {
  it("nettoie, trie et plafonne le plan", () => {
    const plan = normalizeDevelopmentPlan(rawPlan());
    expect(plan?.title).toBe("Plan remise en forme");
    expect(plan?.schedule.map((day) => day.weekday)).toEqual([1, 3]);
    expect(plan?.habits).toHaveLength(DEVELOPMENT_PLAN_LIMITS.habits);
    expect(plan?.habits[0]?.weekdays).toEqual([2]);
    expect(plan?.tasks[0]?.dueInDays).toBe(
      DEVELOPMENT_PLAN_LIMITS.taskHorizonDays,
    );
    expect(plan?.goal?.targetInDays).toBe(DEVELOPMENT_PLAN_LIMITS.goalMinDays);
  });

  it("ne garde rien en cas de détresse ou de plan vide", () => {
    expect(normalizeDevelopmentPlan(rawPlan({ crisis: true }))).toBeNull();
    expect(
      normalizeDevelopmentPlan(rawPlan({ schedule: [], sections: [] })),
    ).toBeNull();
  });
});

describe("prompts", () => {
  it("la demande contient les réponses, citées, et la précision « Autre »", () => {
    const prompt = developmentPrompt({
      kind: "physical",
      today: TODAY,
      answers: {
        mainGoal: "other",
        mainGoalOther: "Courir 10 km",
        breakfast: "Œufs",
      },
      occupation: null,
      dailyMinutes: 30,
    });
    expect(prompt).toContain('- mainGoal: "other" (other: "Courir 10 km")');
    expect(prompt).toContain('- breakfast: "Œufs"');
    expect(prompt).toContain("Plan type: physical");
  });

  it("chaque consigne prévoit la détresse et la langue de l'utilisateur", () => {
    for (const kind of DEVELOPMENT_KINDS) {
      const text = developmentInstructions(kind, "fr");
      expect(text).toContain("crisis: true");
      expect(text).toContain("Québec");
    }
  });
});

describe("textes du questionnaire", () => {
  type Tree = Record<string, unknown>;
  const at = (messages: Tree, path: string[]) =>
    path.reduce<unknown>(
      (node, key) => (node as Tree | undefined)?.[key],
      messages,
    );

  it("chaque question, section et option a son texte en français et en anglais", () => {
    for (const messages of [fr, en] as Tree[]) {
      for (const kind of DEVELOPMENT_KINDS) {
        for (const section of QUESTIONNAIRES[kind]) {
          expect(
            at(messages, ["Development", "sections", kind, section.id]),
            `${kind}.${section.id}`,
          ).toBeTypeOf("string");
        }
        for (const field of allFields(kind)) {
          const base = ["Development", "questions", kind, field.id];
          expect(
            at(messages, [...base, "label"]),
            `${kind}.${field.id}`,
          ).toBeTypeOf("string");
          if (field.type === "choice" || field.type === "multi") {
            for (const option of field.options) {
              expect(
                at(messages, [...base, "options", option]),
                `${kind}.${field.id}.${option}`,
              ).toBeTypeOf("string");
            }
          }
          if (field.type === "scale") {
            expect(at(messages, [...base, "min"])).toBeTypeOf("string");
            expect(at(messages, [...base, "max"])).toBeTypeOf("string");
          }
        }
      }
    }
  });
});
