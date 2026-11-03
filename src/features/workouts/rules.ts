import { z } from "zod";

// Carnet d'entraînement (décision du fondateur, 2026-11-02). Listes et limites
// alignées sur la migration 20261116120000_workouts (un test le vérifie).
// Fonctions pures, testées dans workouts.test.ts.

export const WEIGHT_UNITS = ["kg", "lb"] as const;
export type WeightUnit = (typeof WEIGHT_UNITS)[number];

export const WORKOUT_LIMITS = {
  /** Exercices d'une séance (les mêmes 10 que le plan, positions 0 à 9). */
  exercises: 10,
  sets: 10,
  /** 1 000 kg au plus par série. */
  weightGrams: 1_000_000,
  reps: 500,
  seconds: 3600,
  title: 80,
  /** Séries envoyées au plus par synchronisation. */
  syncSets: 100,
} as const;

/** Ressenti : de 1 (très facile) à 5 (très dur). */
export const FEELINGS = [1, 2, 3, 4, 5] as const;
/** Une séance se note le jour même ou, hors ligne, jusqu'à 6 jours après. */
export const WORKOUT_DAYS_BACK = 6;
/** Repos proposé quand le plan n'en donne pas. */
export const DEFAULT_REST_SECONDS = 60;
/** Séries proposées quand le plan ne dit pas combien. */
export const DEFAULT_SETS = 3;
/** Ajout suggéré quand toutes les séries sont réussies, selon l'unité. */
export const WEIGHT_STEP: Record<WeightUnit, number> = { kg: 2.5, lb: 5 };
/** Équipement sans poids à noter : ces exercices n'ont pas de champ de poids. */
const UNLOADED_EQUIPMENT = new Set(["bodyweight", "bands"]);

const GRAMS_PER_POUND = 453.59237;

/** Ce que le plan demande pour un exercice. */
export type Prescription = {
  sets: number;
  /** Répétitions visées (« 10 à 12 » : 10 et 12) ; null : pas d'objectif. */
  repsMin: number | null;
  repsMax: number | null;
  /** Exercice chronométré (« 3 × 40 s ») ; null sinon. */
  seconds: number | null;
  restSeconds: number | null;
  /** « Par jambe », « par bras », « par côté ». */
  perSide: boolean;
};

const TIME_UNIT = "(s|secs?|secondes?|seconds?|mins?|minutes?)";
const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
const toSeconds = (value: number, unit: string | undefined) =>
  unit?.startsWith("m") ? value * 60 : value;

/**
 * Lit le détail écrit dans le plan : « 4 × 8, repos 90 s », « 3 × 10 à 12 »,
 * « 3 × 40 s », « 3 × 8 par jambe », « 5 min ». Sans format reconnu : 3 séries,
 * sans objectif de répétitions.
 */
export function parsePrescription(detail: string): Prescription {
  const text = detail.replace(/[  ]/g, " ").toLowerCase();
  // Le repos d'abord : ses chiffres ne sont pas des répétitions
  const rest = new RegExp(
    `(?:repos|rest|récup(?:ération)?|recovery)\\D{0,10}(\\d+)\\s*${TIME_UNIT}?(?:\\s*(\\d{1,2}))?`,
  ).exec(text);
  const restSeconds = rest
    ? toSeconds(Number(rest[1]), rest[2]) +
      (rest[2]?.startsWith("m") && rest[3] ? Number(rest[3]) : 0)
    : null;
  const body = rest ? text.replace(rest[0], " ") : text;
  const perSide =
    /(?:par|chaque)\s+(?:jambe|bras|côté)|(?:per|each)\s+(?:leg|arm|side)/.test(
      body,
    );

  const main = new RegExp(
    `(\\d+)\\s*[×x*]\\s*(\\d+)(?:\\s*(?:à|-|–|to)\\s*(\\d+))?\\s*${TIME_UNIT}?(?![a-zà-ÿ])`,
  ).exec(body);
  if (main) {
    const low = Number(main[2]);
    const high = main[3] ? Number(main[3]) : low;
    const sets = clamp(Number(main[1]), 1, WORKOUT_LIMITS.sets);
    if (main[4]) {
      return {
        sets,
        repsMin: null,
        repsMax: null,
        seconds: Math.min(
          toSeconds(Math.max(low, high), main[4]),
          WORKOUT_LIMITS.seconds,
        ),
        restSeconds,
        perSide,
      };
    }
    return {
      sets,
      repsMin: Math.min(Math.min(low, high), WORKOUT_LIMITS.reps),
      repsMax: Math.min(Math.max(low, high), WORKOUT_LIMITS.reps),
      seconds: null,
      restSeconds,
      perSide,
    };
  }

  const setsWord = /(\d+)\s*(?:séries?|sets?)(?![a-zà-ÿ])/.exec(body);
  const repsWord =
    /(\d+)(?:\s*(?:à|-|–|to)\s*(\d+))?\s*(?:répétitions?|reps?)(?![a-zà-ÿ])/.exec(
      body,
    );
  const sets = setsWord
    ? clamp(Number(setsWord[1]), 1, WORKOUT_LIMITS.sets)
    : null;
  if (repsWord) {
    const low = Number(repsWord[1]);
    const high = repsWord[2] ? Number(repsWord[2]) : low;
    return {
      sets: sets ?? DEFAULT_SETS,
      repsMin: Math.min(Math.min(low, high), WORKOUT_LIMITS.reps),
      repsMax: Math.min(Math.max(low, high), WORKOUT_LIMITS.reps),
      seconds: null,
      restSeconds,
      perSide,
    };
  }
  const time = new RegExp(`(\\d+)\\s*${TIME_UNIT}(?![a-zà-ÿ])`).exec(body);
  if (time) {
    return {
      // Un bloc d'un seul tenant (« 5 min d'échauffement »)
      sets: sets ?? 1,
      repsMin: null,
      repsMax: null,
      seconds: Math.min(
        toSeconds(Number(time[1]), time[2]),
        WORKOUT_LIMITS.seconds,
      ),
      restSeconds,
      perSide,
    };
  }
  return {
    sets: sets ?? DEFAULT_SETS,
    repsMin: null,
    repsMax: null,
    seconds: null,
    restSeconds,
    perSide,
  };
}

/** Grammes → valeur affichée dans l'unité (2 décimales au plus). */
export function toDisplayWeight(grams: number, unit: WeightUnit) {
  const value = unit === "kg" ? grams / 1000 : grams / GRAMS_PER_POUND;
  return Math.round(value * 100) / 100;
}

/** Valeur dans l'unité → grammes. */
export function fromDisplayWeight(value: number, unit: WeightUnit) {
  return Math.round(unit === "kg" ? value * 1000 : value * GRAMS_PER_POUND);
}

/** Poids tapé (« 22,5 ») → grammes ; null s'il est vide, invalide ou trop grand. */
export function parseWeightText(text: string, unit: WeightUnit): number | null {
  const normalized = text.trim().replace(",", ".");
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(normalized)) return null;
  const grams = fromDisplayWeight(Number(normalized), unit);
  return grams <= WORKOUT_LIMITS.weightGrams ? grams : null;
}

/** Grammes → valeur d'un champ (« 22,5 » en français). */
export function weightFieldText(
  grams: number | null,
  unit: WeightUnit,
  locale: string,
) {
  if (grams === null) return "";
  const text = String(toDisplayWeight(grams, unit));
  return locale === "fr" ? text.replace(".", ",") : text;
}

/** Une série telle qu'elle se note. */
export type SetValues = {
  weightGrams: number | null;
  reps: number | null;
  seconds: number | null;
};
export type SetLog = SetValues & {
  position: number;
  setNumber: number;
  done: boolean;
};
/** Une série faite lors d'une séance passée. */
export type PastSet = SetValues & { setNumber: number };

/** Ce qu'on sait d'un exercice avant de commencer. */
export type ExerciseHistory = {
  /** Faux pour le poids du corps et les élastiques : pas de champ de poids. */
  loaded: boolean;
  last: { day: string; sets: PastSet[] } | null;
  best: SetValues | null;
};

/** Clé d'un exercice dans l'historique : sa fiche du catalogue, sinon son nom. */
export const exerciseKey = (exercise: { ref: string | null; name: string }) =>
  exercise.ref ?? exercise.name;

/** Un exercice a-t-il un poids à noter, d'après ses étiquettes du catalogue ? */
export function isLoaded(tags: readonly string[] | null): boolean {
  if (!tags) return true;
  const equipment = tags
    .filter((tag) => tag.startsWith("equipment:"))
    .map((tag) => tag.slice("equipment:".length));
  return (
    equipment.length === 0 ||
    equipment.some((value) => !UNLOADED_EQUIPMENT.has(value))
  );
}

/** Répétitions proposées : l'objectif, ou dans une fourchette, là où on en était. */
function proposedReps(prescription: Prescription, past: number | null) {
  const { repsMin, repsMax } = prescription;
  if (repsMin === null || repsMax === null) return past;
  if (repsMin === repsMax) return repsMin;
  return clamp(past ?? repsMin, repsMin, repsMax);
}

/**
 * Les séries préremplies d'un exercice : le poids de la dernière fois et les
 * répétitions visées. La plupart du temps, il ne reste qu'à toucher ✓.
 */
export function prefillSets(
  prescription: Prescription,
  history: ExerciseHistory | null,
): (SetValues & { setNumber: number })[] {
  const past = history?.last?.sets ?? [];
  return Array.from({ length: prescription.sets }, (_, index) => {
    const setNumber = index + 1;
    const previous =
      past.find((set) => set.setNumber === setNumber) ?? past.at(-1) ?? null;
    return {
      setNumber,
      weightGrams:
        history?.loaded === false ? null : (previous?.weightGrams ?? null),
      reps:
        prescription.seconds !== null
          ? null
          : proposedReps(prescription, previous?.reps ?? null),
      seconds: prescription.seconds,
    };
  });
}

/**
 * Poids suggéré (en grammes) quand toutes les séries de la dernière fois ont
 * atteint l'objectif, au haut de la fourchette : le plus petit poids réussi,
 * plus 2,5 kg ou 5 lb. Une simple suggestion, jamais imposée ; null sinon.
 */
export function suggestWeight(
  prescription: Prescription,
  history: ExerciseHistory | null,
  unit: WeightUnit,
): number | null {
  const sets = history?.last?.sets ?? [];
  const target = prescription.repsMax;
  if (target === null || sets.length < prescription.sets) return null;
  if (!sets.every((set) => (set.reps ?? 0) >= target)) return null;
  const weights = sets.map((set) => set.weightGrams ?? 0);
  const lightest = Math.min(...weights);
  if (lightest <= 0) return null;
  return fromDisplayWeight(
    toDisplayWeight(lightest, unit) + WEIGHT_STEP[unit],
    unit,
  );
}

/** Une série bat-elle l'autre ? Le poids d'abord, puis les répétitions ou le temps. */
export function isBetterSet(candidate: SetValues, than: SetValues) {
  const score = (set: SetValues) => [
    set.weightGrams ?? 0,
    set.reps ?? 0,
    set.seconds ?? 0,
  ];
  const a = score(candidate);
  const b = score(than);
  for (let index = 0; index < a.length; index++) {
    const left = a[index] ?? 0;
    const right = b[index] ?? 0;
    if (left !== right) return left > right;
  }
  return false;
}

/** La meilleure série d'une liste ; null si elle est vide. */
export function bestSet(sets: readonly SetValues[]): SetValues | null {
  let best: SetValues | null = null;
  for (const set of sets) {
    if (!best || isBetterSet(set, best)) {
      best = {
        weightGrams: set.weightGrams,
        reps: set.reps,
        seconds: set.seconds,
      };
    }
  }
  return best;
}

/**
 * Historique d'un exercice à partir de ses séries faites, de la plus récente à
 * la plus ancienne séance : la dernière séance et le meilleur résultat.
 */
export function historyFromRows(
  rows: readonly (PastSet & { sessionId: string; day: string })[],
): Pick<ExerciseHistory, "last" | "best"> {
  const first = rows[0];
  if (!first) return { last: null, best: null };
  return {
    last: {
      day: first.day,
      sets: rows
        .filter((row) => row.sessionId === first.sessionId)
        .map(({ setNumber, weightGrams, reps, seconds }) => ({
          setNumber,
          weightGrams,
          reps,
          seconds,
        })),
    },
    best: bestSet(rows),
  };
}

/** Un record battu pendant une séance. */
export type WorkoutRecord = SetValues & { exercise: string };

/**
 * Records d'une séance : la meilleure série de chaque exercice, si elle bat
 * l'ancienne. La toute première fois n'est pas un record.
 */
export function findRecords(
  exercises: readonly {
    position: number;
    name: string;
    previousBest: SetValues | null;
  }[],
  sets: readonly SetLog[],
): WorkoutRecord[] {
  return exercises.flatMap((exercise) => {
    if (!exercise.previousBest) return [];
    const best = bestSet(
      sets.filter((set) => set.position === exercise.position && set.done),
    );
    return best && isBetterSet(best, exercise.previousBest)
      ? [{ exercise: exercise.name, ...best }]
      : [];
  });
}

/** Séries faites, séries prévues et volume total (poids × répétitions, en grammes). */
export function workoutTotals(
  plannedSets: readonly number[],
  sets: readonly SetLog[],
) {
  const done = sets.filter((set) => set.done);
  const total = plannedSets.reduce((sum, planned, position) => {
    const logged = sets.filter((set) => set.position === position).length;
    return sum + Math.max(planned, logged);
  }, 0);
  return {
    doneSets: done.length,
    totalSets: total,
    volumeGrams: done.reduce(
      (sum, set) => sum + (set.weightGrams ?? 0) * (set.reps ?? 0),
      0,
    ),
  };
}

/** Durée d'une séance en minutes, 1 au moins. */
export function workoutMinutes(startedAt: string, finishedAt: string) {
  const elapsed =
    new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  return Math.max(1, Math.round(elapsed / 60_000));
}

/** Temps écoulé, « 12:34 » ou « 1:02:03 ». */
export function formatElapsed(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = String(seconds % 60).padStart(2, "0");
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${rest}`
    : `${minutes}:${rest}`;
}

const setKeySchema = z.object({
  position: z
    .number()
    .int()
    .min(0)
    .max(WORKOUT_LIMITS.exercises - 1),
  setNumber: z.number().int().min(1).max(WORKOUT_LIMITS.sets),
});

export const setLogSchema = setKeySchema.extend({
  weightGrams: z
    .number()
    .int()
    .min(0)
    .max(WORKOUT_LIMITS.weightGrams)
    .nullable(),
  reps: z.number().int().min(0).max(WORKOUT_LIMITS.reps).nullable(),
  seconds: z.number().int().min(0).max(WORKOUT_LIMITS.seconds).nullable(),
  done: z.boolean(),
});

/**
 * Ce que le téléphone envoie : la séance se retrouve par son jour et le jour de
 * la semaine type, donc renvoyer deux fois la même chose ne change rien.
 */
export const workoutSyncSchema = z.object({
  day: z.iso.date(),
  weekday: z.number().int().min(1).max(7),
  startedAt: z.iso.datetime(),
  sets: z.array(setLogSchema).max(WORKOUT_LIMITS.syncSets),
  removed: z.array(setKeySchema).max(WORKOUT_LIMITS.syncSets),
  finish: z
    .object({
      finishedAt: z.iso.datetime(),
      feeling: z
        .number()
        .int()
        .min(FEELINGS[0])
        .max(FEELINGS[FEELINGS.length - 1] ?? 5)
        .nullable(),
    })
    .nullable(),
});
export type WorkoutSync = z.infer<typeof workoutSyncSchema>;

/** Exercice figé dans une séance (JSON relu depuis la base). */
export const workoutExercisesSchema = z.array(
  z.object({
    name: z.string(),
    detail: z.string(),
    ref: z.string().nullable(),
  }),
);
export type WorkoutExercise = z.infer<typeof workoutExercisesSchema>[number];

export const workoutRecordsSchema = z.array(
  z.object({
    exercise: z.string(),
    weightGrams: z.number().nullable(),
    reps: z.number().nullable(),
    seconds: z.number().nullable(),
  }),
);

/** Une séance de la semaine en cours, telle que la lit la page du plan. */
export type WorkoutSessionRow = {
  day: string;
  weekday: number;
  title: string;
  startedAt: string;
  finishedAt: string | null;
  feeling: number | null;
  exercises: WorkoutExercise[];
  records: WorkoutRecord[];
  sets: SetLog[];
};

/** Tout ce que la page d'un plan d'entraînement reçoit du serveur. */
export type WorkoutPageData = {
  /** Sépare les brouillons de ce téléphone d'un compte à l'autre. */
  ownerId: string;
  unit: WeightUnit | null;
  sessions: WorkoutSessionRow[];
  /** Par exercice du plan (`exerciseKey`). */
  history: Record<string, ExerciseHistory>;
};

export type WorkoutError =
  "dayInvalid" | "noPlan" | "sessionMissing" | "noSetDone" | "invalid";
