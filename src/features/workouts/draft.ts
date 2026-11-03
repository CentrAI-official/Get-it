import { z } from "zod";
import {
  exerciseKey,
  parsePrescription,
  prefillSets,
  setLogSchema,
  WORKOUT_LIMITS,
  type ExerciseHistory,
  type Prescription,
  type SetLog,
  type WorkoutExercise,
  type WorkoutSessionRow,
  type WorkoutSync,
} from "./rules";

// Le brouillon d'une séance : ce que le téléphone garde pendant l'entraînement.
// Chaque changement y entre tout de suite, puis part au serveur dès qu'il y a
// du réseau (au gym, le signal coupe souvent). Fonctions pures, testées.

/** Un exercice tel que le carnet l'affiche. */
export type LoggerExercise = WorkoutExercise & {
  position: number;
  prescription: Prescription;
  history: ExerciseHistory | null;
};

const setKeySchema = z.object({
  position: z.number().int(),
  setNumber: z.number().int(),
});

export const workoutDraftSchema = z.object({
  day: z.iso.date(),
  weekday: z.number().int(),
  startedAt: z.iso.datetime(),
  /** Dernier changement gardé sur le téléphone. */
  touchedAt: z.iso.datetime().optional(),
  sets: z.array(setLogSchema),
  /** Séries à envoyer au serveur (`setKey`). */
  dirty: z.array(z.string()),
  removed: z.array(setKeySchema),
  /** « Terminer » touché, pas encore reçu par le serveur. */
  finish: z
    .object({
      finishedAt: z.iso.datetime(),
      feeling: z.number().int().nullable(),
    })
    .nullable(),
});
export type WorkoutDraft = z.infer<typeof workoutDraftSchema>;

export const setKey = (set: { position: number; setNumber: number }) =>
  `${set.position}:${set.setNumber}`;

const bySet = (a: SetLog, b: SetLog) =>
  a.position - b.position || a.setNumber - b.setNumber;

/** Les exercices du carnet, avec ce que le plan demande et leur historique. */
export function buildExercises(
  items: readonly WorkoutExercise[],
  history: Readonly<Record<string, ExerciseHistory>>,
): LoggerExercise[] {
  return items
    .slice(0, WORKOUT_LIMITS.exercises)
    .map(({ name, detail, ref }, position) => ({
      name,
      detail,
      ref,
      position,
      prescription: parsePrescription(detail),
      history: history[exerciseKey({ ref, name })] ?? null,
    }));
}

/**
 * Nouveau brouillon : les séries déjà enregistrées, sinon celles préremplies.
 * Rien n'est à envoyer tant que la personne n'a touché à rien.
 */
export function startDraft(input: {
  day: string;
  weekday: number;
  now: string;
  exercises: readonly LoggerExercise[];
  saved: Pick<WorkoutSessionRow, "startedAt" | "sets"> | null;
}): WorkoutDraft {
  const sets = input.exercises.flatMap((exercise) => {
    const saved = (input.saved?.sets ?? []).filter(
      (set) => set.position === exercise.position,
    );
    // Seules les séries touchées sont enregistrées : les autres restent à faire
    const missing = prefillSets(exercise.prescription, exercise.history)
      .filter(
        (set) => !saved.some((entry) => entry.setNumber === set.setNumber),
      )
      .map((set) => ({ ...set, position: exercise.position, done: false }));
    return [...saved, ...missing];
  });
  return {
    day: input.day,
    weekday: input.weekday,
    startedAt: input.saved?.startedAt ?? input.now,
    sets: sets.sort(bySet),
    dirty: [],
    removed: [],
    finish: null,
  };
}

/** Reprend ce que le téléphone n'a pas encore envoyé, par-dessus le serveur. */
export function mergeStored(
  base: WorkoutDraft,
  stored: WorkoutDraft | null,
): WorkoutDraft {
  if (!stored) return base;
  const pending = stored.sets.filter((set) =>
    stored.dirty.includes(setKey(set)),
  );
  const replaced = new Set([
    ...pending.map(setKey),
    ...stored.removed.map(setKey),
  ]);
  return {
    ...base,
    startedAt:
      stored.startedAt < base.startedAt ? stored.startedAt : base.startedAt,
    sets: [
      ...base.sets.filter((set) => !replaced.has(setKey(set))),
      ...pending,
    ].sort(bySet),
    dirty: stored.dirty,
    removed: stored.removed,
    finish: stored.finish,
  };
}

/** Change une série : elle part au serveur au prochain envoi. */
export function changeSet(
  draft: WorkoutDraft,
  key: string,
  patch: Partial<Pick<SetLog, "weightGrams" | "reps" | "seconds" | "done">>,
): WorkoutDraft {
  return {
    ...draft,
    sets: draft.sets.map((set) =>
      setKey(set) === key ? { ...set, ...patch } : set,
    ),
    dirty: draft.dirty.includes(key) ? draft.dirty : [...draft.dirty, key],
  };
}

export const setsOf = (draft: WorkoutDraft, position: number) =>
  draft.sets.filter((set) => set.position === position);

/**
 * Change le poids d'une série. Les suivantes pas encore faites qui avaient le
 * même poids suivent : pas besoin de le retaper (une pyramide reste intacte).
 */
export function changeWeight(
  draft: WorkoutDraft,
  key: string,
  weightGrams: number | null,
): WorkoutDraft {
  const current = draft.sets.find((set) => setKey(set) === key);
  if (!current) return draft;
  const followers = draft.sets.filter(
    (set) =>
      set.position === current.position &&
      set.setNumber > current.setNumber &&
      !set.done &&
      set.weightGrams === current.weightGrams,
  );
  return [current, ...followers].reduce(
    (next, set) => changeSet(next, setKey(set), { weightGrams }),
    draft,
  );
}

/** Applique un poids (la suggestion) à toutes les séries pas encore faites. */
export function applyWeight(
  draft: WorkoutDraft,
  position: number,
  weightGrams: number,
): WorkoutDraft {
  return setsOf(draft, position)
    .filter((set) => !set.done)
    .reduce(
      (next, set) => changeSet(next, setKey(set), { weightGrams }),
      draft,
    );
}

/** Ajoute une série, avec les valeurs de la précédente (10 au plus). */
export function addSet(draft: WorkoutDraft, position: number): WorkoutDraft {
  const sets = setsOf(draft, position);
  const last = sets.at(-1);
  if (sets.length >= WORKOUT_LIMITS.sets) return draft;
  const setNumber = (last?.setNumber ?? 0) + 1;
  const added: SetLog = {
    position,
    setNumber,
    weightGrams: last?.weightGrams ?? null,
    reps: last?.reps ?? null,
    seconds: last?.seconds ?? null,
    done: false,
  };
  const key = setKey(added);
  return {
    ...draft,
    sets: [...draft.sets, added].sort(bySet),
    dirty: [...draft.dirty, key],
    removed: draft.removed.filter((entry) => setKey(entry) !== key),
  };
}

/** Retire la dernière série, si elle n'est pas faite (il en reste au moins une). */
export function removeLastSet(
  draft: WorkoutDraft,
  position: number,
): WorkoutDraft {
  const sets = setsOf(draft, position);
  const last = sets.at(-1);
  if (!last || last.done || sets.length <= 1) return draft;
  const key = setKey(last);
  return {
    ...draft,
    sets: draft.sets.filter((set) => setKey(set) !== key),
    dirty: draft.dirty.filter((entry) => entry !== key),
    removed: [
      ...draft.removed,
      { position: last.position, setNumber: last.setNumber },
    ],
  };
}

export const hasPending = (draft: WorkoutDraft) =>
  draft.dirty.length > 0 || draft.removed.length > 0 || draft.finish !== null;

/** Ce qu'il reste à envoyer (renvoyer deux fois la même chose ne change rien). */
export function syncPayload(draft: WorkoutDraft): WorkoutSync {
  return {
    day: draft.day,
    weekday: draft.weekday,
    startedAt: draft.startedAt,
    sets: draft.sets
      .filter((set) => draft.dirty.includes(setKey(set)))
      .slice(0, WORKOUT_LIMITS.syncSets),
    removed: draft.removed.slice(0, WORKOUT_LIMITS.syncSets),
    finish: draft.finish,
  };
}

/**
 * Après un envoi réussi : ce qui a été reçu n'est plus à envoyer, sauf ce qui a
 * changé entre-temps.
 */
export function afterSync(
  draft: WorkoutDraft,
  sent: WorkoutSync,
): WorkoutDraft {
  const received = new Map(sent.sets.map((set) => [setKey(set), set]));
  const sentRemoved = new Set(sent.removed.map(setKey));
  return {
    ...draft,
    dirty: draft.dirty.filter((key) => {
      const current = draft.sets.find((set) => setKey(set) === key);
      const copy = received.get(key);
      return !copy || JSON.stringify(current) !== JSON.stringify(copy);
    }),
    removed: draft.removed.filter((entry) => !sentRemoved.has(setKey(entry))),
    finish: sent.finish ? null : draft.finish,
  };
}

/** Le brouillon vaut-il la peine d'être gardé (la personne a touché à quelque chose) ? */
export const hasActivity = (draft: WorkoutDraft) =>
  hasPending(draft) || draft.sets.some((set) => set.done);
