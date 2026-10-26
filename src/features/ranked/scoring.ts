import type { RankedAnswers, RankedCountry } from "./questionnaire";
import {
  CA_INFLATION_2023_TO_2025,
  CA_WEALTH_2023,
  CAD_PER_USD_PPP,
  HOURLY_AGE_GROUPS,
  HOURLY_REFERENCE,
  INCOME_TAIL_ALPHA,
  JUMP_AGE_GROUPS,
  JUMP_NORMS,
  JUMP_REFERENCE,
  JUMP_SPREAD,
  PUSH_UP_AGE_GROUPS,
  PUSH_UP_BANDS,
  PUSH_UP_REFERENCE,
  REACH_AGE_GROUPS,
  REACH_NORMS,
  REACH_REFERENCE,
  REACH_TOES_INCHES,
  SAVINGS_RATE,
  SAVINGS_REFERENCE,
  SQUAT_AGE_GROUPS,
  SQUAT_NORMS,
  SQUAT_REFERENCE,
  US_HOUSEHOLDS,
  US_INFLATION_2023_TO_2025,
  VO2_AGE_GROUPS,
  VO2MAX_NORMS,
  VO2MAX_REFERENCE,
  WEALTH_AGE_GROUPS,
  WEALTH_REFERENCE,
  WEALTH_TAIL_ALPHA,
  type Anchor,
  type Reference,
  type SexNorm,
} from "./reference";
import {
  US_NET_HOURLY_2023,
  US_WEALTH_2025,
  US_WEALTH_AGE_SHARE,
} from "./reference-data";

// Calcul du niveau Ranked : fonctions pures, testées dans ranked.test.ts. Le
// niveau d'un pilier (physique, financier) est le pourcentage de la population
// du Canada et des États-Unis que la personne dépasse, dans sa tranche d'âge ;
// le niveau total est la moyenne des deux. Le social et le mental ne sont pas
// classés (ils restent privés).

export const RANKED_PILLARS = ["physical", "financial"] as const;
export type RankedPillar = (typeof RANKED_PILLARS)[number];

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

type CurveOptions = {
  /** Interpolation sur l'échelle logarithmique (revenus, patrimoine). */
  log?: boolean;
  /** Au-delà du dernier point : queue de Pareto de cet exposant. */
  tailAlpha?: number;
};

/**
 * Percentile d'une valeur sur une courbe de points [valeur, percentile] triés.
 * Plusieurs points de même valeur (ex. beaucoup de revenus nuls) : le milieu
 * de leur part de la population.
 */
export function percentileOf(
  value: number,
  anchors: readonly Anchor[],
  options: CurveOptions = {},
): number {
  const first = anchors[0];
  const last = anchors.at(-1);
  if (!first || !last) return 50;

  const same = anchors.filter(([v]) => v === value);
  if (same.length > 0) {
    const below = anchors.filter(([v]) => v < value).at(-1)?.[1] ?? 0;
    const top = Math.max(...same.map(([, p]) => p));
    return clamp(same.length > 1 ? (below + top) / 2 : top, 0, 100);
  }

  if (value < first[0]) {
    // Sous le premier point : de 0 (valeur nulle) au premier point, sinon on
    // prolonge la première pente
    if (value >= 0 && first[0] > 0) return (value / first[0]) * first[1];
    const next = anchors.find(([v]) => v > first[0]);
    if (!next) return clamp(first[1] / 2, 0, 100);
    const slope = (next[1] - first[1]) / (next[0] - first[0]);
    return clamp(first[1] - (first[0] - value) * slope, 0, 100);
  }

  if (value > last[0]) {
    if (options.tailAlpha && last[0] > 0) {
      const share = (100 - last[1]) * (value / last[0]) ** -options.tailAlpha;
      return clamp(100 - share, 0, 99.99);
    }
    const previous = anchors.filter(([v]) => v < last[0]).at(-1);
    if (!previous) return last[1];
    const slope = (last[1] - previous[1]) / (last[0] - previous[0]);
    return clamp(last[1] + (value - last[0]) * slope, 0, 99.9);
  }

  const low = anchors.filter(([v]) => v < value).at(-1) ?? first;
  const high = anchors.find(([v]) => v > value) ?? last;
  const t =
    options.log && low[0] > 0
      ? Math.log(value / low[0]) / Math.log(high[0] / low[0])
      : (value - low[0]) / (high[0] - low[0]);
  return clamp(low[1] + t * (high[1] - low[1]), 0, 100);
}

/** Percentile d'une valeur dans une loi normale (fonction d'erreur d'Abramowitz et Stegun). */
export function normalPercentile(value: number, mean: number, sd: number) {
  const z = (value - mean) / (sd * Math.SQRT2);
  const t = 1 / (1 + 0.3275911 * Math.abs(z));
  const poly =
    t *
    (0.254829592 +
      t *
        (-0.284496736 +
          t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const erf = 1 - poly * Math.exp(-z * z);
  return clamp(50 * (1 + Math.sign(z) * erf), 0.1, 99.9);
}

/** Niveau de 1 à 100 : le pourcentage de la population dépassé, arrondi. */
export function levelFromPercentile(percentile: number) {
  return clamp(Math.round(percentile), 1, 100);
}

/** Indice de la tranche d'âge (bornes inférieures croissantes), la première et la dernière ouvertes. */
export function ageGroupIndex(age: number, starts: readonly number[]) {
  let index = 0;
  starts.forEach((start, i) => {
    if (age >= start) index = i;
  });
  return index;
}

/** Normes des hommes, des femmes, ou la moyenne des deux sans précision. */
function bySex(
  sexNorm: RankedAnswers["sexNorm"],
  percentile: (sex: SexNorm) => number,
) {
  return sexNorm === "unspecified"
    ? (percentile("male") + percentile("female")) / 2
    : percentile(sexNorm);
}

// --- Physique ----------------------------------------------------------------

/** VO2max (mL/kg/min) d'après la distance d'une course de 12 minutes (Cooper, 1968). */
export function vo2FromCooper(meters: number) {
  return Math.round(clamp((meters - 504.9) / 44.73, 10, 90) * 10) / 10;
}

export function vo2Percentile(
  vo2max: number,
  sexNorm: RankedAnswers["sexNorm"],
  age: number,
) {
  const index = ageGroupIndex(age, VO2_AGE_GROUPS);
  return bySex(sexNorm, (sex) =>
    percentileOf(vo2max, VO2MAX_NORMS[sex][index] ?? []),
  );
}

/**
 * Courbe des pompes d'après les catégories de la SCPE : chaque catégorie couvre
 * un cinquième de la population ; au-delà d'« excellent », la courbe continue
 * jusqu'au 99e percentile à trois fois le seuil.
 */
export function pushUpCurve(bands: readonly number[]): Anchor[] {
  const [poor = 0, fair = 0, good = 0, veryGood = 0] = bands;
  const excellent = veryGood + 1;
  return [
    [0, 0],
    [poor + 0.5, 20],
    [fair + 0.5, 40],
    [good + 0.5, 60],
    [veryGood + 0.5, 80],
    [excellent * 2, 97],
    [excellent * 3, 99.5],
  ];
}

export function pushUpPercentile(
  count: number,
  sexNorm: RankedAnswers["sexNorm"],
  age: number,
) {
  const index = ageGroupIndex(age, PUSH_UP_AGE_GROUPS);
  return bySex(sexNorm, (sex) =>
    percentileOf(count, pushUpCurve(PUSH_UP_BANDS[sex][index] ?? [])),
  );
}

/** Flexion assise : centimètres au-delà des orteils (ou qui manquent), sur la règle du YMCA. */
export function reachPercentile(
  side: RankedAnswers["reachSide"],
  cm: number,
  sexNorm: RankedAnswers["sexNorm"],
  age: number,
) {
  const inches = REACH_TOES_INCHES + ((side === "beyond" ? 1 : -1) * cm) / 2.54;
  const index = ageGroupIndex(age, REACH_AGE_GROUPS);
  return bySex(sexNorm, (sex) =>
    percentileOf(inches, REACH_NORMS[sex][index] ?? []),
  );
}

export function squatPercentile(
  count: number,
  sexNorm: RankedAnswers["sexNorm"],
  age: number,
) {
  const index = ageGroupIndex(age, SQUAT_AGE_GROUPS);
  return bySex(sexNorm, (sex) =>
    percentileOf(count, SQUAT_NORMS[sex][index] ?? []),
  );
}

export function jumpPercentile(
  cm: number,
  sexNorm: RankedAnswers["sexNorm"],
  age: number,
) {
  const index = ageGroupIndex(age, JUMP_AGE_GROUPS);
  return bySex(sexNorm, (sex) => {
    const mean = JUMP_NORMS[sex][index] ?? 0;
    return normalPercentile(cm, mean, mean * JUMP_SPREAD);
  });
}

// --- Financier ---------------------------------------------------------------

/** Montant dans les deux devises, à parité de pouvoir d'achat. */
function inBothCurrencies(amount: number, country: RankedCountry) {
  return country === "CA"
    ? { cad: amount, usd: amount / CAD_PER_USD_PPP }
    : { cad: amount * CAD_PER_USD_PPP, usd: amount };
}

/** Mélange Canada + États-Unis, pondéré par la population de la tranche. */
const mix = (pCa: number, pUs: number, canadians: number, americans: number) =>
  (pCa * canadians + pUs * americans) / (canadians + americans);

/**
 * Revenu net par heure travaillée (dollars d'aujourd'hui) → percentile parmi les
 * gens de son âge qui travaillent. Sans heures de travail : un revenu sans
 * travail est tout en haut, aucun revenu tout en bas.
 */
export function hourlyPercentile(
  netIncome: number,
  weeklyHours: number,
  country: RankedCountry,
  age: number,
) {
  if (weeklyHours === 0) return netIncome > 0 ? 99.9 : 0;
  const { usd } = inBothCurrencies(netIncome, country);
  const hourly = usd / US_INFLATION_2023_TO_2025 / (weeklyHours * 52);
  const group = HOURLY_AGE_GROUPS[ageGroupIndex(age, [16, 25, 35, 45, 55, 65])];
  return percentileOf(hourly, US_NET_HOURLY_2023[group ?? "25-34"], {
    log: true,
    tailAlpha: INCOME_TAIL_ALPHA,
  });
}

/** Courbe canadienne d'une tranche d'âge : la forme d'ensemble ramenée à la médiane de l'âge. */
export function canadianWealthCurve(
  group: (typeof WEALTH_AGE_GROUPS)[number],
): Anchor[] {
  const ratio = CA_WEALTH_2023.medianByAge[group] / CA_WEALTH_2023.medianAll;
  return CA_WEALTH_2023.all.map(([value, p]) => [value * ratio, p] as const);
}

/** Valeur nette du ménage (actifs moins dettes, dollars d'aujourd'hui) → percentile dans la tranche d'âge. */
export function wealthPercentile(
  netWorth: number,
  country: RankedCountry,
  age: number,
) {
  const group =
    WEALTH_AGE_GROUPS[ageGroupIndex(age, [0, 35, 45, 55, 65])] ?? "18-34";
  const { cad, usd } = inBothCurrencies(netWorth, country);
  const options = { log: true, tailAlpha: WEALTH_TAIL_ALPHA };
  return mix(
    percentileOf(
      cad / CA_INFLATION_2023_TO_2025,
      canadianWealthCurve(group),
      options,
    ),
    // Le SCF diffusé est déjà en dollars de 2025
    percentileOf(usd, US_WEALTH_2025[group], options),
    CA_WEALTH_2023.householdsByAge[group],
    US_WEALTH_AGE_SHARE[group] * US_HOUSEHOLDS,
  );
}

/** Taux d'épargne : la part du revenu net qui reste après les dépenses de l'année. */
export function savingsRate(netIncome: number, monthlyExpenses: number) {
  if (netIncome <= 0) return monthlyExpenses > 0 ? -1 : 0;
  return clamp((netIncome - monthlyExpenses * 12) / netIncome, -1, 1);
}

export function savingsPercentile(netIncome: number, monthlyExpenses: number) {
  return percentileOf(savingsRate(netIncome, monthlyExpenses), SAVINGS_RATE);
}

// --- Niveaux -----------------------------------------------------------------

export const RANKED_FACTORS = [
  "run",
  "pushUps",
  "reach",
  "squats",
  "jump",
  "hourly",
  "netWorth",
  "savings",
] as const;
export type RankedFactorKey = (typeof RANKED_FACTORS)[number];

export type RankedFactor = Reference & {
  key: RankedFactorKey;
  /** Percentile, arrondi au dixième. */
  percentile: number;
  /** Poids dans le pilier. */
  weight: number;
  /** Comparé aux gens du même âge (sinon, à tous les adultes). */
  byAge: boolean;
};

export type RankedPillarResult = {
  level: number;
  percentile: number;
  factors: RankedFactor[];
};

export type RankedResult = {
  pillars: Record<RankedPillar, RankedPillarResult>;
  total: { level: number; percentile: number };
  /** VO2max estimé d'après la course de 12 minutes. */
  vo2max: number;
};

const round1 = (value: number) => Math.round(value * 10) / 10;

type FactorInput = {
  key: RankedFactorKey;
  percentile: number;
  weight: number;
  byAge: boolean;
  reference: Reference;
};

function pillar(factors: FactorInput[]): RankedPillarResult {
  const percentile = round1(
    factors.reduce((sum, factor) => sum + factor.percentile * factor.weight, 0),
  );
  return {
    level: levelFromPercentile(percentile),
    percentile,
    factors: factors.map(
      ({ key, percentile: p, weight, byAge, reference }) => ({
        key,
        percentile: round1(p),
        weight,
        byAge,
        ...reference,
      }),
    ),
  };
}

/** Niveaux physique et financier, et niveau total, à partir des réponses validées. */
export function evaluateRanked(answers: RankedAnswers): RankedResult {
  const { age, sexNorm, country } = answers;
  const vo2max = vo2FromCooper(answers.runMeters);
  const pillars: Record<RankedPillar, RankedPillarResult> = {
    // Les tests aux normes publiées comptent plus que les estimations
    physical: pillar([
      {
        key: "run",
        percentile: vo2Percentile(vo2max, sexNorm, age),
        weight: 0.3,
        byAge: true,
        reference: VO2MAX_REFERENCE,
      },
      {
        key: "pushUps",
        percentile: pushUpPercentile(answers.pushUps, sexNorm, age),
        weight: 0.2,
        byAge: true,
        reference: PUSH_UP_REFERENCE,
      },
      {
        key: "reach",
        percentile: reachPercentile(
          answers.reachSide,
          answers.reachCm,
          sexNorm,
          age,
        ),
        weight: 0.2,
        byAge: true,
        reference: REACH_REFERENCE,
      },
      {
        key: "squats",
        percentile: squatPercentile(answers.squats, sexNorm, age),
        weight: 0.15,
        byAge: true,
        reference: SQUAT_REFERENCE,
      },
      {
        key: "jump",
        percentile: jumpPercentile(answers.jumpCm, sexNorm, age),
        weight: 0.15,
        byAge: true,
        reference: JUMP_REFERENCE,
      },
    ]),
    financial: pillar([
      {
        key: "hourly",
        percentile: hourlyPercentile(
          answers.netIncome,
          answers.weeklyHours,
          country,
          age,
        ),
        weight: 1 / 3,
        byAge: true,
        reference: HOURLY_REFERENCE,
      },
      {
        key: "netWorth",
        percentile: wealthPercentile(
          answers.assets - answers.debts,
          country,
          age,
        ),
        weight: 1 / 3,
        byAge: true,
        reference: WEALTH_REFERENCE,
      },
      {
        key: "savings",
        percentile: savingsPercentile(
          answers.netIncome,
          answers.monthlyExpenses,
        ),
        weight: 1 / 3,
        byAge: false,
        reference: SAVINGS_REFERENCE,
      },
    ]),
  };
  const percentile = round1(
    (pillars.physical.percentile + pillars.financial.percentile) / 2,
  );
  return {
    pillars,
    total: { level: levelFromPercentile(percentile), percentile },
    vo2max,
  };
}
