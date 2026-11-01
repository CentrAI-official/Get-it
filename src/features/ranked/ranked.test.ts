import { describe, expect, it } from "vitest";
import { rankedPersonSchema, type RankedPerson } from "./questionnaire";
import {
  BENCH_NORMS,
  PUSH_UP_BANDS,
  REACH_NORMS,
  US_INFLATION_2023_TO_2025,
  VO2MAX_NORMS,
} from "./reference";
import { US_NET_HOURLY_2023, US_WEALTH_2025 } from "./reference-data";
import {
  benchPercentile,
  hourlyPercentile,
  jumpPercentile,
  levelFromPercentile,
  normalPercentile,
  oneRepMax,
  percentileOf,
  pushUpPercentile,
  reachPercentile,
  savingsPercentile,
  savingsRate,
  squatPercentile,
  vo2FromCooper,
  vo2Percentile,
  wealthPercentile,
} from "./scoring";

const person: RankedPerson = { country: "CA", age: 30, sex: "male" };

describe("percentileOf", () => {
  const curve = [
    [0, 10],
    [0, 30],
    [100, 50],
    [1000, 90],
  ] as const;

  it("interpole entre deux points, en échelle logarithmique si demandé", () => {
    expect(percentileOf(550, curve)).toBeCloseTo(70);
    expect(percentileOf(316.2, curve, { log: true })).toBeCloseTo(70, 0);
  });

  it("une valeur répétée prend le milieu de sa part (ex. revenus nuls)", () => {
    expect(percentileOf(0, curve)).toBe(15);
  });

  it("une valeur négative prolonge la première pente", () => {
    expect(
      percentileOf(-50, [
        [0, 10],
        [100, 20],
      ]),
    ).toBe(5);
  });

  it("au-delà du dernier point, queue de Pareto sans jamais atteindre 100", () => {
    const top = percentileOf(4000, curve, { tailAlpha: 2 });
    expect(top).toBeGreaterThan(99);
    expect(top).toBeLessThan(100);
  });
});

describe("normalPercentile et levelFromPercentile", () => {
  it("la moyenne au 50e, un écart-type au 84e", () => {
    expect(normalPercentile(100, 100, 15)).toBeCloseTo(50, 1);
    expect(normalPercentile(115, 100, 15)).toBeCloseTo(84.1, 0);
  });

  it("niveau de 1 à 100", () => {
    expect(levelFromPercentile(0)).toBe(1);
    expect(levelFromPercentile(87.4)).toBe(87);
    expect(levelFromPercentile(99.6)).toBe(100);
  });
});

describe("tests physiques", () => {
  it("la course de 12 minutes donne le VO2max (Cooper)", () => {
    expect(vo2FromCooper(2400)).toBe(42.4);
    expect(vo2Percentile(46.5, "male", 25)).toBe(50);
    expect(vo2Percentile(46.5, "male", 17)).toBe(50);
  });

  it("pompes : « excellent » de la SCPE au-delà du 80e percentile", () => {
    expect(pushUpPercentile(36, "male", 25)).toBeGreaterThan(80);
    expect(pushUpPercentile(16, "male", 25)).toBeLessThan(20);
    // Normes féminines : pompes sur les genoux
    expect(pushUpPercentile(30, "female", 25)).toBeGreaterThan(80);
    // Plus vieux, le même nombre vaut plus
    expect(pushUpPercentile(20, "male", 55)).toBeGreaterThan(
      pushUpPercentile(20, "male", 25),
    );
  });

  it("souplesse : toucher ses orteils, ou les dépasser", () => {
    // Règle du YMCA : les orteils à 15 pouces (hommes 18-25 : 15 = 40e)
    expect(reachPercentile(0, "male", 22)).toBe(40);
    expect(reachPercentile(18, "male", 22)).toBeGreaterThan(90);
    expect(reachPercentile(-10, "male", 22)).toBeLessThan(
      reachPercentile(0, "male", 22),
    );
  });

  it("squats et saut : la médiane au milieu", () => {
    expect(squatPercentile(38, "male", 25)).toBe(50);
    expect(jumpPercentile(184, "male", 25)).toBeCloseTo(50, 0);
    expect(jumpPercentile(136, "female", 25)).toBeCloseTo(50, 0);
  });

  it("les femmes sont comparées aux femmes", () => {
    expect(vo2Percentile(40, "female", 25)).toBeGreaterThan(
      vo2Percentile(40, "male", 25),
    );
  });
});

describe("force rapportée au poids", () => {
  it("le 1RM s'estime d'après la charge et les répétitions (Epley)", () => {
    expect(oneRepMax(100, 1)).toBe(100);
    expect(oneRepMax(80, 6)).toBeCloseTo(96);
  });

  it("développé couché : la médiane de la Cooper Institute au milieu", () => {
    expect(benchPercentile(1.06, "male", 25)).toBe(50);
    expect(benchPercentile(0.65, "female", 25)).toBe(50);
    // Plus vieux, le même rapport vaut plus
    expect(benchPercentile(0.9, "male", 55)).toBeGreaterThan(
      benchPercentile(0.9, "male", 25),
    );
  });
});

describe("finances", () => {
  it("revenu net par heure : la médiane américaine des 25-34 ans au milieu", () => {
    const median =
      US_NET_HOURLY_2023["25-34"].find(([, p]) => p === 50)?.[0] ?? 0;
    const yearly = median * US_INFLATION_2023_TO_2025 * 40 * 52;
    const p = hourlyPercentile(yearly / (40 * 52), "US", 30);
    expect(p).toBeGreaterThan(48);
    expect(p).toBeLessThan(52);
  });

  it("un revenu horaire plus haut vaut plus, aucun revenu tout en bas", () => {
    expect(hourlyPercentile(45, "CA", 30)).toBeGreaterThan(
      hourlyPercentile(25, "CA", 30),
    );
    expect(hourlyPercentile(0, "CA", 40)).toBe(0);
  });

  it("valeur nette : la médiane américaine des 18-34 ans au milieu", () => {
    const median = US_WEALTH_2025["18-34"].find(([, p]) => p === 50)?.[0] ?? 0;
    const p = wealthPercentile(median, "US", 28);
    expect(p).toBeGreaterThan(45);
    expect(p).toBeLessThan(58);
    expect(wealthPercentile(-50_000, "CA", 30)).toBeLessThan(10);
  });

  it("taux d'épargne : dépenser plus qu'on gagne est en bas", () => {
    expect(savingsRate(50_000, 2_000)).toBeCloseTo(0.52);
    expect(savingsPercentile(savingsRate(50_000, 2_000))).toBeGreaterThan(90);
    expect(savingsPercentile(savingsRate(50_000, 5_000))).toBeLessThan(16.3);
    expect(savingsRate(0, 1_000)).toBe(-1);
  });
});

describe("rankedPersonSchema", () => {
  it("le compte donne une personne de 16 ans et plus, au Canada ou aux États-Unis", () => {
    expect(rankedPersonSchema.safeParse(person).success).toBe(true);
    expect(rankedPersonSchema.safeParse({ ...person, age: 15 }).success).toBe(
      false,
    );
    expect(
      rankedPersonSchema.safeParse({ ...person, country: "FR" }).success,
    ).toBe(false);
    expect(
      rankedPersonSchema.safeParse({ ...person, sex: "unspecified" }).success,
    ).toBe(false);
  });
});

describe("données de référence", () => {
  const increasing = (values: readonly number[]) =>
    values.every(
      (value, index) => index === 0 || value >= (values[index - 1] ?? 0),
    );

  it("les courbes montent", () => {
    for (const curve of Object.values(US_NET_HOURLY_2023)) {
      expect(increasing(curve.map(([value]) => value))).toBe(true);
    }
    for (const groups of [
      ...Object.values(VO2MAX_NORMS),
      ...Object.values(REACH_NORMS),
      ...Object.values(BENCH_NORMS),
    ]) {
      for (const curve of groups) {
        expect(increasing(curve.map(([value]) => value))).toBe(true);
      }
    }
    for (const groups of Object.values(PUSH_UP_BANDS)) {
      for (const bands of groups) expect(increasing(bands)).toBe(true);
    }
  });
});
