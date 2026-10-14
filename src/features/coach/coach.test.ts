import { describe, expect, it } from "vitest";
import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";
import { formatCoachContext, type CoachContextData } from "./context";
import { coachMessageSchema, COACH_MESSAGE_MAX_LENGTH } from "./limits";
import { parseInline, parseMessage } from "./message-format";
import { coachInstructions, goalPlanInstructions } from "./prompts";

describe("parseMessage", () => {
  it("découpe paragraphes, listes à puces et numérotées", () => {
    const blocks = parseMessage(
      "Bravo pour ta série.\nContinue.\n\n- Méditer\n- Courir\n\n1. Lundi\n2. Mardi",
    );
    expect(blocks.map((block) => block.type)).toEqual([
      "paragraph",
      "bullets",
      "numbered",
    ]);
    expect(blocks[0]).toMatchObject({ type: "paragraph" });
    expect(blocks[0]?.type === "paragraph" && blocks[0].lines.length).toBe(2);
    expect(blocks[1]?.type === "bullets" && blocks[1].items.length).toBe(2);
  });

  it("met en gras le texte entre ** et ne garde jamais de HTML actif", () => {
    expect(parseInline("Fais **ceci** puis <b>cela</b>")).toEqual([
      { text: "Fais ", bold: false },
      { text: "ceci", bold: true },
      { text: " puis <b>cela</b>", bold: false },
    ]);
  });

  it("transforme un titre en ligne en gras", () => {
    expect(parseMessage("## Ton plan")).toEqual([
      { type: "paragraph", lines: [[{ text: "Ton plan", bold: true }]] },
    ]);
  });
});

describe("coachMessageSchema", () => {
  it("refuse un message vide ou trop long", () => {
    expect(
      coachMessageSchema.safeParse({ conversationId: null, content: "  " })
        .success,
    ).toBe(false);
    expect(
      coachMessageSchema.safeParse({
        conversationId: null,
        content: "a".repeat(COACH_MESSAGE_MAX_LENGTH + 1),
      }).success,
    ).toBe(false);
    expect(
      coachMessageSchema.safeParse({
        conversationId: "pas-un-id",
        content: "Salut",
      }).success,
    ).toBe(false);
  });
});

describe("formatCoachContext", () => {
  const data: CoachContextData = {
    today: "2026-10-14",
    name: "Max",
    occupation: "entrepreneur",
    focusPillars: ["physical", "financial"],
    dailyMinutes: 30,
    level: {
      level: 2,
      xp: 205,
      pillarLevels: { physical: 1, mental: 1, social: 1, financial: 1 },
    },
    scores: { physical: 24, mental: 44, social: 40, financial: null },
    quests: [
      {
        title: "Méditer 10 minutes",
        kind: "habit",
        pillar: "mental",
        done: true,
        overdueSince: null,
        goal: null,
        streak: 2,
      },
      {
        title: "Appeler le club",
        kind: "task",
        pillar: "physical",
        done: false,
        overdueSince: "2026-10-12",
        goal: "Courir un demi-marathon",
        streak: null,
      },
    ],
    goals: [
      {
        title: "Courir un demi-marathon",
        pillar: "physical",
        targetDate: "2027-05-01",
        milestones: [
          { title: "Courir 5 km", done: true },
          { title: "Courir 10 km", done: false },
        ],
        openTasks: [{ title: "Appeler le club", dueDate: "2026-10-12" }],
      },
    ],
    habits: [
      {
        title: "Méditer 10 minutes",
        pillar: "mental",
        weekdays: [1, 2, 3, 4, 5, 6, 7],
        currentStreak: 2,
        bestStreak: 3,
        doneToday: true,
      },
    ],
    checkIns: [{ day: "2026-10-14", mood: 4, energy: 3, stress: 2, sleep: 5 }],
  };

  it("résume les données utiles, sans rien inventer", () => {
    const context = formatCoachContext(data);
    expect(context).toContain("Today: 2026-10-14 (Wednesday)");
    expect(context).toContain("Focus pillars: Physical, Financial");
    expect(context).toContain("Level 2 (205 XP)");
    expect(context).toContain("Financial no data");
    expect(context).toContain(
      '[done] "Méditer 10 minutes" (habit, Mental, streak 2 days)',
    );
    expect(context).toContain("overdue since 2026-10-12");
    expect(context).toContain("milestones 1/2 done");
    expect(context).toContain(
      "every day, current streak 2, best 3, done today",
    );
    expect(context).toContain(
      "2026-10-14: mood 4, energy 3, stress 2, sleep 5",
    );
  });

  it("dit clairement quand il n'y a rien", () => {
    const context = formatCoachContext({
      ...data,
      quests: [],
      goals: [],
      habits: [],
      checkIns: [],
    });
    expect(context).toContain("- none planned");
    expect(context).toContain("- none yet");
    expect(context.match(/- none/g)?.length).toBe(4);
  });

  it("borne la taille du contexte", () => {
    const many = Array.from({ length: 40 }, (_, i) => ({
      ...data.quests[1]!,
      title: `Tâche ${i}`,
    }));
    const context = formatCoachContext({ ...data, quests: many });
    expect(context).toContain('"Tâche 14"');
    expect(context).not.toContain('"Tâche 15"');
  });
});

describe("consignes de Get iT AI", () => {
  it("répondent dans la langue de l'utilisateur, avec les garde-fous", () => {
    const fr = coachInstructions("fr");
    expect(fr).toContain("French as spoken in Québec");
    expect(fr).toContain("9-8-8");
    expect(fr).toContain("Créer mon plan avec l’IA");
    expect(coachInstructions("en")).toContain("Create my plan with AI");
    expect(goalPlanInstructions("en")).toContain("English.");
  });

  it("ont tous leurs textes en français et en anglais", () => {
    for (const messages of [fr, en]) {
      expect(messages.Coach.consent.processor).toContain("Anthropic");
      expect(Object.keys(messages.Coach.errors)).toHaveLength(6);
      expect(Object.keys(messages.Goals.plan.errors)).toHaveLength(7);
    }
  });
});
