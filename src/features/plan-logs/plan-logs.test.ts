import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEVELOPMENT_PLAN_LIMITS } from "@/features/development/plan";
import { KIND_PILLAR } from "@/features/development/questionnaires";
import {
  applyLogChange,
  breathAt,
  breathLabel,
  breathPatternOf,
  findLog,
  LOGGED_KINDS,
  logDayOf,
  OUTCOMES,
  planBudgetSchema,
  PLAN_LOG_LIMITS,
  planLogSchema,
  practiceMinutes,
  savingsActionOf,
  sessionProgress,
  type PlanLogRow,
} from "./rules";

const row = (overrides: Partial<PlanLogRow> = {}): PlanLogRow => ({
  day: "2026-11-03",
  weekday: 2,
  position: 0,
  item: "Souper",
  replacedBy: null,
  outcome: null,
  budgetCents: null,
  ...overrides,
});

describe("éléments cochés", () => {
  it("note aujourd'hui une séance à venir faite d'avance", () => {
    expect(logDayOf("2026-11-05", "2026-11-03")).toBe("2026-11-03");
    expect(logDayOf("2026-11-02", "2026-11-03")).toBe("2026-11-02");
    expect(logDayOf("2026-11-03", "2026-11-03")).toBe("2026-11-03");
  });

  it("retrouve un élément par son jour, sa séance, sa place et son nom", () => {
    const rows = [row()];
    expect(findLog(rows, "2026-11-03", 2, 0, "Souper")).toEqual(row());
    expect(findLog(rows, "2026-11-02", 2, 0, "Souper")).toBeNull();
    expect(findLog(rows, "2026-11-03", 3, 0, "Souper")).toBeNull();
    expect(findLog(rows, "2026-11-03", 2, 1, "Souper")).toBeNull();
    // Le plan a changé : un autre élément à cette place n'est pas déjà coché
    expect(findLog(rows, "2026-11-03", 2, 0, "Dîner")).toBeNull();
  });

  it("compte ce qui est fait dans une séance", () => {
    const session = {
      weekday: 2,
      items: [{ name: "Souper" }, { name: "Dîner" }],
    };
    expect(sessionProgress([row()], session, "2026-11-03")).toEqual({
      done: 1,
      total: 2,
    });
    expect(sessionProgress([], session, "2026-11-03")).toEqual({
      done: 0,
      total: 2,
    });
  });

  it("montre un changement avant la réponse du serveur", () => {
    const change = {
      kind: "nutrition" as const,
      day: "2026-11-03",
      weekday: 2,
      position: 0,
      name: "Souper",
      done: true,
      replacedBy: "Pizza",
      outcome: null,
    };
    expect(applyLogChange([], change)[0]?.replacedBy).toBe("Pizza");
    expect(applyLogChange([row()], { ...change, done: false })).toEqual([]);
    // Préciser un élément garde ce qu'il avait ajouté au budget
    expect(
      applyLogChange([row({ budgetCents: 5000 })], change)[0]?.budgetCents,
    ).toBe(5000);
  });

  it("valide ce qui vient du navigateur", () => {
    const valid = {
      kind: "social",
      day: "2026-11-03",
      weekday: 2,
      position: 0,
      done: true,
      replacedBy: null,
      outcome: 3,
    };
    expect(planLogSchema.safeParse(valid).success).toBe(true);
    for (const wrong of [
      { kind: "physical" },
      { weekday: 8 },
      { position: PLAN_LOG_LIMITS.positions },
      { outcome: 4 },
      { replacedBy: "x".repeat(PLAN_LOG_LIMITS.replacedBy + 1) },
      { replacedBy: "   " },
      // Le nom vient du plan, jamais du navigateur
      { item: "Autre chose" },
    ]) {
      expect(planLogSchema.safeParse({ ...valid, ...wrong }).success).toBe(
        false,
      );
    }
    const budget = {
      kind: "financial",
      day: "2026-11-03",
      weekday: 2,
      position: 0,
      amount: "50",
    };
    expect(planBudgetSchema.safeParse(budget).success).toBe(true);
    expect(
      planBudgetSchema.safeParse({ ...budget, kind: "mental" }).success,
    ).toBe(false);
  });

  it("compte chaque plan pour le pilier écrit dans la série", () => {
    // Même règle que le CASE de getActivity : seule la nutrition change de nom
    for (const kind of LOGGED_KINDS) {
      expect(KIND_PILLAR[kind]).toBe(kind === "nutrition" ? "physical" : kind);
    }
  });
});

describe("pratique guidée", () => {
  it("lit la durée écrite dans la pratique", () => {
    expect(practiceMinutes("Respiration 4-7-8 5 minutes assis")).toBe(5);
    expect(practiceMinutes("Marche, 10 min")).toBe(10);
    expect(practiceMinutes("Meditate for 15 mins")).toBe(15);
    expect(practiceMinutes("Journal de gratitude")).toBeNull();
    expect(practiceMinutes("Pendant 240 minutes")).toBeNull();
  });

  it("reconnaît une respiration et son rythme", () => {
    expect(breathPatternOf("Journal de gratitude")).toBeNull();
    expect(breathPatternOf("Respiration 4-7-8")).toEqual({
      inhale: 4,
      hold: 7,
      exhale: 8,
      rest: 0,
    });
    expect(breathPatternOf("4-7-8 breathing")?.exhale).toBe(8);
    expect(breathPatternOf("Respiration carrée")).toEqual({
      inhale: 4,
      hold: 4,
      exhale: 4,
      rest: 4,
    });
    expect(breathPatternOf("Cohérence cardiaque")).toEqual({
      inhale: 5,
      hold: 0,
      exhale: 5,
      rest: 0,
    });
    expect(breathPatternOf("Souffle 4-6")).toEqual({
      inhale: 4,
      hold: 0,
      exhale: 6,
      rest: 0,
    });
    // Sans rythme écrit : le 4-7-8
    expect(breathPatternOf("Respiration profonde")?.hold).toBe(7);
  });

  it("ne prend pas une durée pour un rythme", () => {
    expect(breathPatternOf("Respiration 5-10 minutes")?.hold).toBe(7);
    expect(breathPatternOf("Respiration 3-5 min")?.hold).toBe(7);
    expect(breathPatternOf("Respiration 4-30-8")?.hold).toBe(7);
  });

  it("écrit le rythme sans les temps à zéro", () => {
    expect(breathLabel({ inhale: 4, hold: 7, exhale: 8, rest: 0 })).toBe(
      "4-7-8",
    );
    expect(breathLabel({ inhale: 5, hold: 0, exhale: 5, rest: 0 })).toBe("5-5");
  });

  it("suit les temps de la respiration", () => {
    const pattern = { inhale: 4, hold: 7, exhale: 8, rest: 0 };
    expect(breathAt(pattern, 0)).toEqual({
      phase: "inhale",
      left: 4,
      fill: 0,
    });
    expect(breathAt(pattern, 2).fill).toBe(0.5);
    expect(breathAt(pattern, 4)).toEqual({ phase: "hold", left: 7, fill: 1 });
    expect(breathAt(pattern, 11)).toEqual({
      phase: "exhale",
      left: 8,
      fill: 1,
    });
    expect(breathAt(pattern, 15).fill).toBe(0.5);
    // Un nouveau cycle après 19 secondes
    expect(breathAt(pattern, 19).phase).toBe("inhale");
    expect(breathAt(pattern, 19 * 3 + 4).phase).toBe("hold");
  });

  it("saute un temps à zéro et garde le cercle vide au dernier", () => {
    const coherence = { inhale: 5, hold: 0, exhale: 5, rest: 0 };
    expect(breathAt(coherence, 5).phase).toBe("exhale");
    const box = { inhale: 4, hold: 4, exhale: 4, rest: 4 };
    expect(breathAt(box, 13)).toEqual({ phase: "rest", left: 3, fill: 0 });
  });
});

describe("action financière", () => {
  it("reconnaît une action d'épargne et son montant", () => {
    expect(savingsActionOf("Virer 50 $ vers ton épargne")).toEqual({
      cents: 5000,
    });
    expect(savingsActionOf("Transfer $50 to your savings")).toEqual({
      cents: 5000,
    });
    expect(savingsActionOf("Virement CELI de 1 250,50 $")).toEqual({
      cents: 125050,
    });
    expect(savingsActionOf("Mets de côté pour ton fonds d’urgence")).toEqual({
      cents: null,
    });
  });

  it("ignore les autres actions", () => {
    expect(savingsActionOf("Revoir tes dépenses de la semaine")).toBeNull();
    expect(savingsActionOf("Annuler un abonnement de 15 $")).toBeNull();
  });
});

describe("migration", () => {
  const sql = readFileSync(
    join(
      process.cwd(),
      "prisma/migrations/20261117120000_plan_item_logs/migration.sql",
    ),
    "utf8",
  );

  it("garde les mêmes limites que les règles", () => {
    expect(PLAN_LOG_LIMITS.positions).toBe(DEVELOPMENT_PLAN_LIMITS.itemsPerDay);
    const kinds = LOGGED_KINDS.map((kind) => `'${kind}'`).join(", ");
    expect(sql).toContain(`"kind" IN (${kinds})`);
    expect(sql).toContain(
      `"position" BETWEEN 0 AND ${PLAN_LOG_LIMITS.positions - 1}`,
    );
    expect(sql).toContain(
      `char_length("item") BETWEEN 1 AND ${PLAN_LOG_LIMITS.item}`,
    );
    expect(sql).toContain(
      `char_length("replaced_by") BETWEEN 1 AND ${PLAN_LOG_LIMITS.replacedBy}`,
    );
    expect(sql).toContain(
      `"outcome" BETWEEN ${OUTCOMES[0]} AND ${OUTCOMES[OUTCOMES.length - 1]}`,
    );
    expect(sql).toContain('"plan_item_logs" ENABLE ROW LEVEL SECURITY');
  });
});
