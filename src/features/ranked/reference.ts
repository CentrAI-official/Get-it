// Tableaux de référence du mode Ranked (physique et financier) : où se situe
// une valeur dans la population, dans la tranche d'âge (et le sexe pour le
// physique) de la personne. Chaque tableau cite sa source ; `estimate` signale
// une référence construite faute de normes publiées pour le Canada et les
// États-Unis. Les courbes calculées sur microdonnées sont dans reference-data.ts.

/** Point d'une courbe : la valeur et la part de la population en dessous (en %). */
export type Anchor = readonly [value: number, percentile: number];

export type Reference = {
  /** Source affichée dans l'explication du niveau. */
  source: string;
  /** Référence approximative (pas de normes publiées pour ce test). */
  estimate: boolean;
};

export type SexNorm = "male" | "female";

// --- Conversions -------------------------------------------------------------

/** Parité de pouvoir d'achat 2024 : 1,2409 $ CA valent 1 $ US (Banque mondiale, PA.NUS.PRVT.PP). */
export const CAD_PER_USD_PPP = 1.240903;

/** Inflation de 2023 à 2025 : IPC du Canada (Banque mondiale) et IPC-U des États-Unis (FRED, moyenne des mois publiés). */
export const CA_INFLATION_2023_TO_2025 = 140.970234688036 / 134.895535203205;
export const US_INFLATION_2023_TO_2025 = 321.962 / 304.703;

/** Au-delà du dernier point, la part restante décroît comme une loi de Pareto. */
export const INCOME_TAIL_ALPHA = 2;
export const WEALTH_TAIL_ALPHA = 1.5;

// --- Financier ---------------------------------------------------------------

/** Tranches d'âge du revenu par heure. */
export const HOURLY_AGE_GROUPS = [
  "16-24",
  "25-34",
  "35-44",
  "45-54",
  "55-64",
  "65+",
] as const;

export const HOURLY_REFERENCE: Reference = {
  source:
    "Census Bureau, CPS ASEC 2024 (revenu après impôt par heure travaillée ; même courbe pour le Canada, faute de données publiques)",
  estimate: false,
};

/** Tranches d'âge du patrimoine (âge du répondant ou du principal soutien). */
export const WEALTH_AGE_GROUPS = [
  "18-34",
  "35-44",
  "45-54",
  "55-64",
  "65+",
] as const;

/**
 * Valeur nette des ménages canadiens en 2023 : médianes des quintiles (soit les
 * percentiles 10, 30, 50, 70 et 90 de l'ensemble) et médiane de chaque tranche
 * d'âge du principal soutien ; nombre de ménages. Source : Statistique Canada,
 * Enquête sur la sécurité financière 2023 (tableaux 11-10-0049-01 et
 * 11-10-0016-01). La forme d'ensemble est ramenée à la médiane de chaque âge.
 */
export const CA_WEALTH_2023 = {
  all: [
    [12_800, 10],
    [174_300, 30],
    [519_700, 50],
    [1_078_600, 70],
    [2_488_700, 90],
  ] as readonly Anchor[],
  medianAll: 519_700,
  medianByAge: {
    "18-34": 159_100,
    "35-44": 409_300,
    "45-54": 675_800,
    "55-64": 873_400,
    "65+": 738_900,
  },
  householdsByAge: {
    "18-34": 3_232_000,
    "35-44": 3_109_000,
    "45-54": 2_733_000,
    "55-64": 3_079_000,
    "65+": 4_698_000,
  },
} as const;

/** Ménages américains représentés par le SCF 2022 (131,3 millions). */
export const US_HOUSEHOLDS = 131_300_000;

export const WEALTH_REFERENCE: Reference = {
  source:
    "Réserve fédérale (Survey of Consumer Finances 2022) et Statistique Canada (Enquête sur la sécurité financière 2023)",
  estimate: false,
};

/**
 * Taux d'épargne (revenu net moins dépenses, sur le revenu net) : 16,3 % des
 * ménages américains dépensent plus qu'ils ne gagnent, 27,1 % autant, 56,5 %
 * moins (SCF 2022, WSAVED). Dans chaque groupe, la répartition des taux est
 * supposée (« autant » : de 0 à 5 % ; épargnants : estimation).
 */
export const SAVINGS_RATE: readonly Anchor[] = [
  [-1, 0],
  [0, 16.3],
  [0.05, 43.4],
  [0.1, 58],
  [0.2, 75],
  [0.3, 86],
  [0.5, 95],
  [0.7, 99],
];
export const SAVINGS_REFERENCE: Reference = {
  source:
    "Réserve fédérale, Survey of Consumer Finances 2022 (dépenses par rapport au revenu)",
  estimate: true,
};

// --- Physique ----------------------------------------------------------------

/** Tranches d'âge du VO2max, de 20-29 ans à 80-89 ans (16-19 ans : 20-29). */
export const VO2_AGE_GROUPS = [20, 30, 40, 50, 60, 70, 80] as const;

/**
 * VO2max sur tapis roulant (mL/kg/min) par sexe et par décennie : percentiles
 * 10 à 90 (registre FRIEND, tous les tests), plus les 5e et 95e (sous-groupe
 * RER ≥ 1,10). Source : Kaminsky et al., Mayo Clinic Proceedings 2022. Le
 * VO2max de la personne vient de sa course de 12 minutes (Cooper, 1968).
 */
const VO2_PERCENTILES = [5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95] as const;
/** Les 5e et 95e viennent d'un sous-groupe : un point qui ne monte pas est écarté. */
const increasing = (
  values: readonly number[],
  percentiles: readonly number[],
) =>
  values.flatMap((value, index) =>
    index > 0 && value <= (values[index - 1] ?? 0)
      ? []
      : [[value, percentiles[index] ?? 0] as const],
  );
const vo2 = (values: readonly number[]): readonly Anchor[] =>
  increasing(values, VO2_PERCENTILES);

export const VO2MAX_NORMS: Record<SexNorm, readonly (readonly Anchor[])[]> = {
  male: [
    vo2([24.8, 28.6, 35.2, 40.0, 43.6, 46.5, 49.0, 51.9, 54.5, 58.6, 62.1]),
    vo2([20.6, 24.9, 29.8, 33.5, 37.0, 39.7, 43.4, 46.4, 50.0, 55.5, 57.9]),
    vo2([19.7, 22.1, 26.7, 29.7, 32.4, 35.3, 37.9, 40.9, 45.2, 50.8, 53.2]),
    vo2([16.5, 18.6, 22.2, 24.5, 26.9, 29.2, 31.8, 34.3, 38.3, 43.4, 46.8]),
    vo2([13.8, 15.8, 18.5, 20.7, 22.8, 24.6, 26.5, 28.7, 32.0, 37.1, 40.2]),
    vo2([11.6, 13.6, 15.9, 17.3, 19.1, 20.6, 22.2, 23.8, 25.9, 29.4, 35.2]),
    vo2([12.2, 12.9, 14.8, 16.1, 16.6, 17.6, 18.4, 20.0, 21.4, 22.8, 25.6]),
  ],
  female: [
    vo2([19.3, 22.5, 27.2, 30.8, 34.0, 36.6, 39.0, 41.8, 44.8, 49.0, 50.1]),
    vo2([16.6, 18.6, 21.9, 24.2, 26.4, 28.3, 31.0, 33.6, 37.0, 42.1, 45.5]),
    vo2([15.3, 17.2, 19.7, 21.8, 23.9, 25.7, 27.7, 30.0, 33.0, 37.8, 40.7]),
    vo2([14.5, 16.5, 18.5, 20.1, 21.5, 22.9, 24.6, 26.3, 28.4, 32.4, 35.3]),
    vo2([12.0, 13.4, 15.4, 17.0, 18.3, 19.6, 20.9, 22.4, 24.3, 27.3, 29.7]),
    vo2([11.3, 12.3, 14.0, 15.2, 16.2, 17.2, 18.3, 19.6, 20.8, 22.8, 24.2]),
    vo2([10.7, 11.4, 12.6, 13.7, 14.7, 15.4, 16.0, 17.3, 18.4, 20.8, 20.7]),
  ],
};
export const VO2MAX_REFERENCE: Reference = {
  source: "Registre FRIEND, Mayo Clinic Proceedings 2022",
  estimate: false,
};

/** Tranches d'âge des pompes : 20-29 à 60-69 ans (16-19 ans : 20-29 ; 70 ans et plus : 60-69). */
export const PUSH_UP_AGE_GROUPS = [20, 30, 40, 50, 60] as const;

/**
 * Pompes d'affilée : limites hautes des catégories « à améliorer », « passable »,
 * « bien » et « très bien » (au-delà : « excellent »), par sexe et par décennie ;
 * les femmes font les pompes sur les genoux. Source : Société canadienne de
 * physiologie de l'exercice, CPAFLA (2003). Chaque catégorie est supposée
 * couvrir un cinquième de la population (de 20 en 20 percentiles).
 */
export const PUSH_UP_BANDS: Record<SexNorm, readonly (readonly number[])[]> = {
  male: [
    [16, 21, 28, 35],
    [11, 16, 21, 29],
    [9, 12, 16, 24],
    [6, 9, 12, 20],
    [4, 7, 10, 17],
  ],
  female: [
    [9, 14, 20, 29],
    [7, 12, 19, 26],
    [4, 10, 14, 23],
    [1, 6, 10, 20],
    [1, 4, 11, 16],
  ],
};
export const PUSH_UP_REFERENCE: Reference = {
  source: "Société canadienne de physiologie de l'exercice, CPAFLA (2003)",
  estimate: false,
};

/** Tranches d'âge de la flexion assise : 18-25 à 65 ans et plus (16-17 ans : 18-25). */
export const REACH_AGE_GROUPS = [18, 26, 36, 46, 56, 66] as const;

/**
 * Flexion assise sur une règle dont la marque de 15 pouces est au talon (le
 * bout des orteils correspond à environ 15 pouces) : percentiles 10 à 90, en
 * pouces, par sexe et tranche d'âge. Source : YMCA, reproduit par l'ACE
 * (Group Fitness Instructor, fitness assessment protocols).
 */
const REACH_PERCENTILES = [10, 20, 30, 40, 50, 60, 70, 80, 90] as const;
const reach = (values: readonly number[]): readonly Anchor[] =>
  values.map((value, index) => [value, REACH_PERCENTILES[index] ?? 0] as const);

export const REACH_NORMS: Record<SexNorm, readonly (readonly Anchor[])[]> = {
  male: [
    reach([11, 13, 14, 15, 17, 18, 19, 20, 22]),
    reach([9, 11, 13, 14, 15, 17, 17, 19, 21]),
    reach([7, 11, 13, 13, 15, 16, 17, 19, 21]),
    reach([6, 9, 10, 11, 13, 14, 15, 17, 19]),
    reach([5, 7, 9, 9, 11, 13, 13, 15, 17]),
    reach([4, 7, 8, 9, 10, 12, 13, 15, 17]),
  ],
  female: [
    reach([14, 16, 17, 18, 19, 20, 21, 22, 24]),
    reach([13, 15, 16, 17, 19, 20, 20, 21, 23]),
    reach([12, 14, 15, 16, 17, 18, 19, 21, 22]),
    reach([10, 12, 14, 14, 16, 17, 18, 20, 21]),
    reach([9, 11, 13, 14, 15, 16, 17, 19, 20]),
    reach([9, 11, 13, 14, 15, 17, 17, 18, 20]),
  ],
};
/** Le bout des orteils, sur la règle du YMCA (en pouces). */
export const REACH_TOES_INCHES = 15;
export const REACH_REFERENCE: Reference = {
  source: "YMCA (normes reproduites par l'ACE)",
  estimate: false,
};

/** Tranches d'âge des squats : 18-29 à 70 ans et plus (16-17 ans : 18-29). */
export const SQUAT_AGE_GROUPS = [18, 30, 40, 50, 60, 70] as const;

/**
 * Squats en 60 secondes, comparés au test « assis-debout en 1 minute » (un
 * mouvement très proche, jusqu'à la hauteur d'une chaise) : percentiles 2,5,
 * 25, 50, 75 et 97,5 par sexe et décennie. Source : One-minute sit-to-stand
 * test, reference values for the Chilean population (PLoS One 2025). Pas de
 * normes pour le squat chez les adultes nord-américains : estimation.
 */
const SQUAT_PERCENTILES = [2.5, 25, 50, 75, 97.5] as const;
const squat = (values: readonly number[]): readonly Anchor[] =>
  values.map((value, index) => [value, SQUAT_PERCENTILES[index] ?? 0] as const);

export const SQUAT_NORMS: Record<SexNorm, readonly (readonly Anchor[])[]> = {
  male: [
    squat([27, 32, 38, 47, 61]),
    squat([26, 31, 39, 47, 55]),
    squat([26, 30, 30, 37, 58]),
    squat([20, 28, 32, 39, 58]),
    squat([15, 23, 25, 30, 37]),
    squat([15, 20, 23, 26, 31]),
  ],
  female: [
    squat([28, 33, 38, 45, 61]),
    squat([23, 33, 38, 44, 60]),
    squat([22, 28, 33, 38, 47]),
    squat([20, 26, 32, 37, 53]),
    squat([17, 23, 28, 33, 49]),
    squat([17, 21, 24, 30, 47]),
  ],
};
export const SQUAT_REFERENCE: Reference = {
  source: "Test assis-debout en 1 minute, population chilienne (PLoS One 2025)",
  estimate: true,
};

/** Tranches d'âge de l'IMC : 16-19, 20-29 … 80 ans et plus. */
export const BMI_AGE_GROUPS = [16, 20, 30, 40, 50, 60, 70, 80] as const;

/**
 * Indice de masse corporelle mesuré (kg/m²) : percentiles 5, 10, 15, 25, 50, 75,
 * 85, 90 et 95 par sexe et tranche d'âge. Source : CDC, NHANES 2015-2018,
 * « Anthropometric Reference Data for Children and Adults », tableaux 14 et 15
 * (20 ans et plus) ; 16-19 ans : moyenne des âges 16 à 19 du tableau 13. Les
 * bornes [12, 0] et [70, 100] ferment la courbe. Pas de tableau équivalent pour
 * le Canada : la courbe américaine sert aussi aux Canadiens.
 */
const BMI_PERCENTILES = [5, 10, 15, 25, 50, 75, 85, 90, 95] as const;
const bmi = (values: readonly number[]): readonly Anchor[] => [
  [12, 0],
  ...values.map(
    (value, index) => [value, BMI_PERCENTILES[index] ?? 0] as const,
  ),
  [70, 100],
];

export const BMI_NORMS: Record<SexNorm, readonly (readonly Anchor[])[]> = {
  male: [
    bmi([17.8, 18.9, 19.7, 20.6, 23.3, 27.4, 30.3, 32.4, 37.4]),
    bmi([18.7, 20.0, 21.0, 22.6, 26.5, 31.6, 34.4, 36.8, 39.5]),
    bmi([21.6, 23.0, 23.8, 25.4, 28.9, 33.7, 36.4, 38.3, 43.4]),
    bmi([22.1, 23.5, 24.7, 26.2, 29.1, 32.8, 35.5, 38.1, 41.8]),
    bmi([21.8, 22.6, 24.0, 25.2, 29.1, 32.8, 35.5, 37.4, 41.7]),
    bmi([22.2, 23.2, 23.9, 25.8, 28.9, 33.3, 35.3, 37.1, 40.3]),
    bmi([20.9, 22.9, 24.1, 25.9, 28.2, 32.8, 34.5, 35.6, 37.2]),
    bmi([21.1, 22.3, 22.9, 24.3, 27.2, 30.2, 32.3, 34.0, 35.5]),
  ],
  female: [
    bmi([18.2, 19.4, 19.8, 21.2, 24.1, 29.0, 32.6, 34.9, 38.6]),
    bmi([18.6, 19.6, 20.4, 21.9, 26.2, 32.9, 37.4, 39.6, 43.3]),
    bmi([19.8, 21.2, 22.0, 23.6, 28.3, 34.2, 38.2, 41.1, 46.1]),
    bmi([20.6, 22.0, 22.8, 24.4, 28.6, 34.8, 39.3, 43.1, 46.6]),
    bmi([19.6, 21.5, 22.5, 24.3, 29.1, 34.2, 37.7, 41.5, 45.7]),
    bmi([20.4, 22.2, 23.2, 24.9, 29.2, 34.7, 37.2, 39.5, 42.9]),
    bmi([20.8, 22.0, 23.3, 25.3, 28.8, 33.3, 35.7, 37.9, 42.1]),
    bmi([19.9, 20.8, 22.2, 23.8, 27.5, 30.8, 33.5, 35.5, 39.3]),
  ],
};

/** Poids santé chez l'adulte (OMS) : un IMC de 18,5 à 24,9. */
export const HEALTHY_BMI = [18.5, 24.9] as const;

/**
 * La règle de classement (plus l'IMC est proche de la plage santé, mieux c'est)
 * est la nôtre, et l'IMC ne distingue pas les muscles de la graisse :
 * estimation (décision du fondateur, 2026-10-26).
 */
export const BMI_REFERENCE: Reference = {
  source:
    "CDC, NHANES 2015-2018 (IMC mesuré ; courbe américaine aussi pour le Canada)",
  estimate: true,
};

/** Tranches d'âge du saut sans élan : 16-29 à 70 ans et plus. */
export const JUMP_AGE_GROUPS = [16, 30, 40, 50, 60, 70] as const;

/**
 * Saut en longueur sans élan (cm) : moyenne par sexe et décennie, écart-type de
 * 18 % de la moyenne (loi normale). Estimation construite faute de normes
 * adultes publiées pour le Canada et les États-Unis : les moyennes de 18 à 64
 * ans correspondent à celles d'adultes espagnols (164 cm pour les hommes,
 * 121 cm pour les femmes), avec une baisse d'environ 8 % par décennie.
 */
export const JUMP_NORMS: Record<SexNorm, readonly number[]> = {
  male: [184, 171, 157, 144, 131, 118],
  female: [136, 126, 116, 106, 97, 87],
};
export const JUMP_SPREAD = 0.18;
export const JUMP_REFERENCE: Reference = {
  source: "Estimation à partir de moyennes d'adultes espagnols (18 à 64 ans)",
  estimate: true,
};
