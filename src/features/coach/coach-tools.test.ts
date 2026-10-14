import { describe, expect, it } from "vitest";
import {
  COACH_TOOLS,
  coachActionPayloadSchema,
  describeActions,
  parseToolCall,
  type GoalRef,
} from "./coach-tools";
import { coachInstructions } from "./prompts";

const today = "2026-10-15";
const goals: GoalRef[] = [
  {
    ref: "G1",
    id: "0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b",
    title: "Courir un demi-marathon",
    pillar: "physical",
  },
];
const ctx = { today, goals };

describe("parseToolCall", () => {
  it("transforme une habitude et la relie à l'objectif par sa référence", () => {
    expect(
      parseToolCall(
        {
          name: "propose_habit",
          input: {
            title: "  Courir   30 minutes ",
            pillar: "physical",
            weekdays: [4, 2, 2, 9],
            goal_ref: "G1",
          },
        },
        ctx,
      ),
    ).toEqual({
      kind: "habit",
      title: "Courir 30 minutes",
      pillar: "physical",
      weekdays: [2, 4],
      goal: { id: goals[0]!.id, title: "Courir un demi-marathon" },
    });
  });

  it("corrige une échéance passée et ignore une échéance trop lointaine", () => {
    const past = parseToolCall(
      {
        name: "propose_task",
        input: { title: "Appeler", due_date: "2026-10-01", goal_ref: null },
      },
      ctx,
    );
    expect(past).toMatchObject({ kind: "task", dueDate: today, goal: null });
    const far = parseToolCall(
      {
        name: "propose_task",
        input: { title: "Appeler", due_date: "2030-01-01" },
      },
      ctx,
    );
    expect(far).toMatchObject({ dueDate: null });
  });

  it("refuse un jalon sans objectif existant, un pilier inconnu ou un outil inconnu", () => {
    expect(
      parseToolCall(
        {
          name: "propose_milestone",
          input: { goal_ref: "G9", title: "10 km" },
        },
        ctx,
      ),
    ).toBeNull();
    expect(
      parseToolCall(
        { name: "propose_goal", input: { title: "Épargner", pillar: "money" } },
        ctx,
      ),
    ).toBeNull();
    expect(
      parseToolCall({ name: "delete_goal", input: { title: "x" } }, ctx),
    ).toBeNull();
    expect(
      parseToolCall({ name: "propose_task", input: "pas un objet" }, ctx),
    ).toBeNull();
  });

  it("garde un objectif complet, sans description ni date si elles manquent", () => {
    expect(
      parseToolCall(
        {
          name: "propose_goal",
          input: { title: "Fonds d'urgence de 1 000 $", pillar: "financial" },
        },
        ctx,
      ),
    ).toEqual({
      kind: "goal",
      title: "Fonds d'urgence de 1 000 $",
      pillar: "financial",
      description: null,
      targetDate: null,
    });
  });
});

describe("outils du coach", () => {
  it("n'offrent que des propositions, avec un schéma fermé", () => {
    expect(COACH_TOOLS.map((tool) => tool.name)).toEqual([
      "propose_goal",
      "propose_habit",
      "propose_task",
      "propose_milestone",
    ]);
    for (const tool of COACH_TOOLS) {
      expect(tool.inputSchema).toMatchObject({ additionalProperties: false });
      expect(tool.description).toContain("confirm");
    }
  });

  it("sont expliqués au modèle (confirmation, références, limite)", () => {
    const instructions = coachInstructions("fr");
    expect(instructions).toContain("propose_habit");
    expect(instructions).toContain("never say it's done");
    expect(instructions).toContain("at most 3");
    expect(instructions).toContain("G1");
  });
});

describe("describeActions", () => {
  it("rappelle au modèle le sort de chaque proposition", () => {
    const habit = coachActionPayloadSchema.parse({
      kind: "habit",
      title: "Lire 20 pages",
      pillar: "mental",
      weekdays: [1, 3, 5],
      goal: null,
    });
    const task = coachActionPayloadSchema.parse({
      kind: "task",
      title: "Appeler le club",
      dueDate: "2026-10-16",
      goal: null,
    });
    expect(
      describeActions([
        { status: "applied", payload: habit },
        { status: "dismissed", payload: task },
      ]),
    ).toBe(
      '[Proposals shown as cards]\n- habit "Lire 20 pages" (Mon, Wed, Fri): added by the user\n- task "Appeler le club" (due 2026-10-16): dismissed by the user',
    );
    expect(describeActions([])).toBe("");
  });
});
