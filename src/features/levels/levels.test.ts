import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  factorPillar,
  factorValue,
  LEVEL_FACTORS,
  measureAnswersSchema,
  measureAvailableAt,
  measureRequestSchema,
} from "./factors";
import {
  eliteValue,
  factorLevel,
  factorThreshold,
  nextLevelGoals,
  pillarLevel,
  THRESHOLD_STEP,
  totalLevel,
  type LevelPerson,
} from "./scale";

const people: LevelPerson[] = [
  { country: "CA", age: 30, sex: "male" },
  { country: "US", age: 52, sex: "female" },
  { country: "CA", age: 19, sex: "female" },
  { country: "US", age: 67, sex: "male" },
];

describe("valeur d'une mesure", () => {
  it("développé couché : 1RM estimé divisé par le poids du corps", () => {
    expect(
      factorValue("bench", { weightKg: 80, benchKg: 80, benchReps: 6 }).value,
    ).toBe(1.2);
  });

  it("flexion : négative quand il manque des centimètres", () => {
    expect(factorValue("reach", { reachSide: "short", reachCm: 7 }).value).toBe(
      -7,
    );
    expect(
      factorValue("reach", { reachSide: "beyond", reachCm: 4 }).value,
    ).toBe(4);
  });

  it("revenu par heure ; sans heures de travail, ramené à un temps plein", () => {
    expect(
      factorValue("hourly", { netIncome: 52_000, weeklyHours: 25 }).value,
    ).toBe(40);
    expect(
      factorValue("hourly", { netIncome: 41_600, weeklyHours: 0 }).value,
    ).toBe(20);
  });

  it("valeur nette et taux d'épargne", () => {
    expect(
      factorValue("netWorth", { assets: 30_000, debts: 45_000 }).value,
    ).toBe(-15_000);
    expect(
      factorValue("savings", { netIncome: 60_000, monthlyExpenses: 4_000 })
        .value,
    ).toBeCloseTo(0.2);
  });
});

describe("seuils et niveaux", () => {
  it("atteindre le seuil d'un niveau donne ce niveau, juste en dessous non", () => {
    for (const person of people) {
      for (const factor of LEVEL_FACTORS) {
        for (const level of [2, 10, 25, 50, 75, 89, 90, 91, 95, 100]) {
          const threshold = factorThreshold(factor, level, person);
          expect(
            factorLevel(factor, threshold, person),
            `${factor} niveau ${level} (${person.sex}, ${person.age})`,
          ).toBeGreaterThanOrEqual(level);
          const below = threshold - THRESHOLD_STEP[factor] * 1.5;
          if (factorThreshold(factor, level - 1, person) < below) {
            expect(
              factorLevel(factor, below, person),
              `${factor} sous le niveau ${level}`,
            ).toBeLessThan(level);
          }
        }
      }
    }
  });

  it("les seuils montent avec le niveau", () => {
    const person = people[0] as LevelPerson;
    for (const factor of LEVEL_FACTORS) {
      const thresholds = [10, 30, 50, 70, 90, 95, 100].map((level) =>
        factorThreshold(factor, level, person),
      );
      expect(thresholds, factor).toEqual([...thresholds].sort((a, b) => a - b));
    }
  });

  it("le sommet humain de son âge donne le niveau 100", () => {
    for (const person of people) {
      for (const factor of LEVEL_FACTORS) {
        expect(factorLevel(factor, eliteValue(factor, person), person)).toBe(
          100,
        );
      }
    }
  });

  it("le sommet baisse avec l'âge pour les tests physiques", () => {
    const young = { country: "CA", age: 25, sex: "male" } as const;
    const old = { ...young, age: 65 };
    expect(eliteValue("run", old)).toBeLessThan(eliteValue("run", young));
    expect(eliteValue("bench", old)).toBeLessThan(eliteValue("bench", young));
  });

  it("niveau 1 au plus bas, jamais 0", () => {
    expect(factorLevel("pushUps", 0, people[0] as LevelPerson)).toBe(1);
    expect(factorLevel("netWorth", -500_000, people[1] as LevelPerson)).toBe(1);
  });
});

describe("piliers", () => {
  it("le plus faible décide ; un pilier incomplet n'a pas de niveau", () => {
    expect(pillarLevel([40, 22, 61])).toBe(22);
    expect(pillarLevel([40, null, 61])).toBeNull();
    expect(pillarLevel([])).toBeNull();
  });

  it("le total : la moyenne des deux piliers, seulement s'ils sont mesurés", () => {
    expect(totalLevel(30, 51)).toBe(41);
    expect(totalLevel(30, null)).toBeNull();
  });

  it("objectifs de niveau : chaque mesure sous le seuil suivant, valeur fixe", () => {
    const person = people[0] as LevelPerson;
    const goals = nextLevelGoals(
      "physical",
      { run: 34, pushUps: 20, reach: 20, squats: 55, jump: 41, bench: 27 },
      person,
    );
    expect(goals.map((goal) => goal.factor)).toEqual(["pushUps", "reach"]);
    for (const goal of goals) {
      expect(goal.level).toBe(21);
      expect(goal.target).toBe(factorThreshold(goal.factor, 21, person));
    }
  });

  it("rien à viser au niveau 100, ni tant que le pilier n'est pas mesuré", () => {
    const person = people[0] as LevelPerson;
    expect(
      nextLevelGoals(
        "financial",
        { hourly: 100, netWorth: 100, savings: 100 },
        person,
      ),
    ).toEqual([]);
    expect(nextLevelGoals("financial", { hourly: 40 }, person)).toEqual([]);
  });
});

describe("formulaires de mesure", () => {
  it("chaque mesure demande ses champs, sans doublon", () => {
    const schema = measureAnswersSchema(["hourly", "savings"]);
    expect(
      schema.safeParse({
        netIncome: "50000",
        weeklyHours: "40",
        monthlyExpenses: "3000",
      }).success,
    ).toBe(true);
    expect(schema.safeParse({ netIncome: "50000" }).success).toBe(false);
  });

  it("des mesures d'un seul pilier à la fois", () => {
    const ok = { factors: ["run", "bench"], answers: {}, consent: false };
    expect(measureRequestSchema.safeParse(ok).success).toBe(true);
    expect(
      measureRequestSchema.safeParse({ ...ok, factors: ["run", "hourly"] })
        .success,
    ).toBe(false);
    expect(
      measureRequestSchema.safeParse({ ...ok, factors: ["run", "run"] })
        .success,
    ).toBe(false);
  });

  it("une même mesure se refait après 7 jours (physique) ou un mois (finances)", () => {
    const last = new Date("2026-11-01T12:00:00Z");
    expect(measureAvailableAt("pushUps", last)?.toISOString()).toBe(
      "2026-11-08T12:00:00.000Z",
    );
    expect(measureAvailableAt("savings", last)?.toISOString()).toBe(
      "2026-12-01T12:00:00.000Z",
    );
    expect(measureAvailableAt("run", null)).toBeNull();
    expect(factorPillar("bench")).toBe("physical");
  });
});

describe("migration", () => {
  it("la contrainte suit la liste des mesures et active le RLS", () => {
    const sql = readFileSync(
      join(
        process.cwd(),
        "prisma/migrations/20261111120000_levels/migration.sql",
      ),
      "utf8",
    );
    expect(sql).toContain(
      `"factor" IN (${LEVEL_FACTORS.map((factor) => `'${factor}'`).join(", ")})`,
    );
    expect(sql).toContain(
      'ALTER TABLE "measurements" ENABLE ROW LEVEL SECURITY',
    );
  });
});
