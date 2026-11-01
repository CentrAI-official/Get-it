import type { RankedPerson } from "@/features/ranked/questionnaire";
import {
  BENCH_REFERENCE,
  ELITE_PERCENTILE,
  ELITE_PHYSICAL,
  ELITE_SAVINGS_RATE,
  HOURLY_REFERENCE,
  JUMP_REFERENCE,
  PUSH_UP_REFERENCE,
  REACH_REFERENCE,
  SAVINGS_REFERENCE,
  SQUAT_REFERENCE,
  VO2MAX_REFERENCE,
  WEALTH_REFERENCE,
  type Reference,
} from "@/features/ranked/reference";
import {
  benchPercentile,
  hourlyPercentile,
  jumpPercentile,
  pushUpPercentile,
  reachPercentile,
  savingsPercentile,
  squatPercentile,
  vo2FromCooper,
  vo2Percentile,
  wealthPercentile,
} from "@/features/ranked/scoring";
import { PILLAR_FACTORS, type LevelFactor, type LevelPillar } from "./factors";

// Niveaux de 1 à 100 (décision du fondateur, 2026-11-01). Fonctions pures,
// testées dans levels.test.ts :
// - une mesure est au niveau N quand sa valeur atteint le seuil du niveau N :
//   jusqu'à 90, la valeur du N-ième percentile de la tranche d'âge (et du sexe
//   pour le physique) ; de 90 à 100, la zone élite, du 90e percentile au
//   sommet humain pour cet âge ;
// - un pilier est au niveau de sa mesure la plus faible ;
// - pour monter, chaque mesure encore sous le seuil suivant devient un
//   objectif de niveau, avec la valeur fixe à atteindre.

export type LevelPerson = RankedPerson;

export const MIN_LEVEL = 1;
export const MAX_LEVEL = 100;
/** Début de la zone élite. */
export const ELITE_LEVEL = 90;

/** Source de chaque mesure, montrée avec son niveau (« Estimation » si approximative). */
export const FACTOR_REFERENCE: Record<LevelFactor, Reference> = {
  run: VO2MAX_REFERENCE,
  pushUps: PUSH_UP_REFERENCE,
  reach: REACH_REFERENCE,
  squats: SQUAT_REFERENCE,
  jump: JUMP_REFERENCE,
  bench: BENCH_REFERENCE,
  hourly: HOURLY_REFERENCE,
  netWorth: WEALTH_REFERENCE,
  savings: SAVINGS_REFERENCE,
};

/** Percentile d'une valeur, dans la tranche d'âge (et le sexe) de la personne. */
export function factorPercentile(
  factor: LevelFactor,
  value: number,
  { age, sex, country }: LevelPerson,
): number {
  switch (factor) {
    case "run":
      return vo2Percentile(vo2FromCooper(value), sex, age);
    case "pushUps":
      return pushUpPercentile(value, sex, age);
    case "reach":
      return reachPercentile(value, sex, age);
    case "squats":
      return squatPercentile(value, sex, age);
    case "jump":
      return jumpPercentile(value, sex, age);
    case "bench":
      return benchPercentile(value, sex, age);
    case "hourly":
      return hourlyPercentile(value, country, age);
    case "netWorth":
      return wealthPercentile(value, country, age);
    case "savings":
      return savingsPercentile(value);
  }
}

/** Valeurs possibles de chaque mesure (bornes de la recherche des seuils). */
const DOMAIN: Record<LevelFactor, readonly [number, number]> = {
  run: [0, 6000],
  pushUps: [0, 300],
  reach: [-60, 60],
  squats: [0, 150],
  jump: [0, 400],
  bench: [0, 4],
  hourly: [0, 1_000_000],
  netWorth: [-10_000_000, 100_000_000_000],
  savings: [-1, 1],
};

/** Pas d'un seuil affiché : on arrondit au-dessus (2 450 m, 34 pompes, 0,95 ×…). */
export const THRESHOLD_STEP: Record<LevelFactor, number> = {
  run: 10,
  pushUps: 1,
  reach: 1,
  squats: 1,
  jump: 1,
  bench: 0.01,
  hourly: 0.5,
  netWorth: 500,
  savings: 0.01,
};

/** Plus petite valeur qui atteint ce percentile (recherche par dichotomie). */
export function valueAtPercentile(
  factor: LevelFactor,
  percentile: number,
  person: LevelPerson,
): number {
  let [low, high] = DOMAIN[factor];
  if (factorPercentile(factor, high, person) < percentile) return high;
  for (let i = 0; i < 80; i++) {
    const middle = (low + high) / 2;
    if (factorPercentile(factor, middle, person) >= percentile) high = middle;
    else low = middle;
  }
  return high;
}

/** La personne de référence de la zone élite physique : même sexe, 25 ans. */
const REFERENCE_AGE = 25;

/**
 * Sommet humain (niveau 100) pour l'âge et le sexe de la personne. Physique :
 * la valeur de classe mondiale des 20-29 ans, en proportion du 95e percentile
 * de sa tranche d'âge ; finances : le 1 ‰ le plus haut de sa tranche d'âge.
 */
export function eliteValue(factor: LevelFactor, person: LevelPerson) {
  if (factor === "savings") return ELITE_SAVINGS_RATE;
  if (factor === "hourly" || factor === "netWorth") {
    return valueAtPercentile(factor, ELITE_PERCENTILE, person);
  }
  const reference = ELITE_PHYSICAL[factor][person.sex];
  // La flexion se mesure depuis les orteils (0) : on l'échelonne depuis le
  // bout de la règle du YMCA, 38 cm avant les orteils
  const offset = factor === "reach" ? 38.1 : 0;
  const p95 = valueAtPercentile(factor, 95, person) + offset;
  const p95Reference =
    valueAtPercentile(factor, 95, { ...person, age: REFERENCE_AGE }) + offset;
  if (p95Reference <= 0) return reference;
  return ((reference + offset) * p95) / p95Reference - offset;
}

/** Arrondi au pas supérieur, sans erreur de virgule flottante (34.000001 → 34). */
function roundUp(value: number, step: number) {
  return Math.ceil(value / step - 1e-9) * step;
}

/** Revenu et patrimoine montent en proportion dans la zone élite (comme leurs courbes). */
const GEOMETRIC: ReadonlySet<LevelFactor> = new Set(["hourly", "netWorth"]);
const geometric = (factor: LevelFactor, start: number, top: number) =>
  GEOMETRIC.has(factor) && start > 0 && top > 0;

/** Valeur à une part `t` (0 à 1) du chemin entre le 90e percentile et le sommet. */
function eliteValueAt(
  factor: LevelFactor,
  start: number,
  top: number,
  t: number,
) {
  return geometric(factor, start, top)
    ? start * (top / start) ** t
    : start + t * (top - start);
}

/** Part du chemin entre le 90e percentile et le sommet qu'une valeur a faite. */
function elitePart(
  factor: LevelFactor,
  value: number,
  start: number,
  top: number,
) {
  return geometric(factor, start, top)
    ? value > 0
      ? Math.log(value / start) / Math.log(top / start)
      : 0
    : (value - start) / (top - start);
}

/** Valeur à atteindre pour être au niveau `level` dans cette mesure, arrondie au pas. */
export function factorThreshold(
  factor: LevelFactor,
  level: number,
  person: LevelPerson,
): number {
  const step = THRESHOLD_STEP[factor];
  const target = Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, level));
  if (target <= ELITE_LEVEL) {
    return roundUp(valueAtPercentile(factor, target, person), step);
  }
  const start = valueAtPercentile(factor, ELITE_LEVEL, person);
  const top = Math.max(eliteValue(factor, person), start);
  return roundUp(
    eliteValueAt(
      factor,
      start,
      top,
      (target - ELITE_LEVEL) / (MAX_LEVEL - ELITE_LEVEL),
    ),
    step,
  );
}

/** Niveau d'une mesure, de 1 à 100. */
export function factorLevel(
  factor: LevelFactor,
  value: number,
  person: LevelPerson,
): number {
  const percentile = factorPercentile(factor, value, person);
  if (percentile < ELITE_LEVEL) {
    return Math.max(MIN_LEVEL, Math.floor(percentile + 1e-9));
  }
  const start = valueAtPercentile(factor, ELITE_LEVEL, person);
  const top = eliteValue(factor, person);
  if (top <= start) return ELITE_LEVEL;
  const part = elitePart(factor, value, start, top);
  return Math.min(
    MAX_LEVEL,
    Math.max(
      ELITE_LEVEL,
      ELITE_LEVEL + Math.floor(part * (MAX_LEVEL - ELITE_LEVEL) + 1e-9),
    ),
  );
}

/** Niveau d'un pilier : sa mesure la plus faible ; null s'il en manque une. */
export function pillarLevel(levels: readonly (number | null)[]) {
  if (levels.length === 0 || levels.some((level) => level === null)) {
    return null;
  }
  return Math.min(...(levels as number[]));
}

/** Niveau total : la moyenne des deux piliers mesurés, ou null s'il en manque un. */
export function totalLevel(physical: number | null, financial: number | null) {
  return physical === null || financial === null
    ? null
    : Math.round((physical + financial) / 2);
}

export type LevelGoal = {
  factor: LevelFactor;
  /** Le niveau que l'objectif permet d'atteindre. */
  level: number;
  /** La valeur fixe à atteindre (unité de la mesure). */
  target: number;
};

/**
 * Objectifs pour passer au niveau suivant d'un pilier : chaque mesure encore
 * sous le seuil suivant, avec la valeur à atteindre. Vide au niveau 100, ou
 * tant que le pilier n'est pas entièrement mesuré.
 */
export function nextLevelGoals(
  pillar: LevelPillar,
  levels: Partial<Record<LevelFactor, number | null>>,
  person: LevelPerson,
): LevelGoal[] {
  const factors = PILLAR_FACTORS[pillar];
  const current = pillarLevel(factors.map((factor) => levels[factor] ?? null));
  if (current === null || current >= MAX_LEVEL) return [];
  const next = current + 1;
  return factors
    .filter((factor) => (levels[factor] ?? 0) < next)
    .map((factor) => ({
      factor,
      level: next,
      target: factorThreshold(factor, next, person),
    }));
}
