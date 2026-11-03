import "server-only";
import { z } from "zod";
import { weekOf } from "@/features/development/calendar";
import {
  storedPlanSchema,
  type DevelopmentPlan,
} from "@/features/development/plan";
import {
  exerciseKey,
  findRecords,
  historyFromRows,
  isLoaded,
  WEIGHT_UNITS,
  WORKOUT_DAYS_BACK,
  WORKOUT_LIMITS,
  workoutExercisesSchema,
  workoutRecordsSchema,
  type ExerciseHistory,
  type SetLog,
  type SetValues,
  type WeightUnit,
  type WorkoutError,
  type WorkoutExercise,
  type WorkoutPageData,
  type WorkoutSessionRow,
  type WorkoutSync,
} from "@/features/workouts/rules";
import {
  addDays,
  daysBetween,
  fromDbDate,
  toCalendarDay,
  toDbDate,
} from "@/lib/dates";
import { db } from "@/server/db";
import { getUserTimeZone } from "@/server/profile/service";

// Carnet d'entraînement. Données privées : chaque fonction reçoit l'userId de la
// session et filtre dessus. Effacées avec le compte (onDelete: Cascade). Le
// téléphone envoie ce qu'il a noté ; le serveur revérifie le jour et relit les
// exercices dans le plan, jamais dans ce que le navigateur envoie.

const uuid = z.uuid();

const setSelect = {
  position: true,
  setNumber: true,
  weightGrams: true,
  reps: true,
  seconds: true,
  done: true,
} as const;

const readExercises = (value: unknown): WorkoutExercise[] => {
  const parsed = workoutExercisesSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
};

/** Exercices d'une séance de la semaine type, figés au début de la séance. */
const exercisesOfPlan = (plan: DevelopmentPlan, weekday: number) => {
  const session = plan.schedule.find((entry) => entry.weekday === weekday);
  if (!session) return null;
  return {
    title: session.title.slice(0, WORKOUT_LIMITS.title),
    exercises: session.items
      .slice(0, WORKOUT_LIMITS.exercises)
      .map(({ name, detail, ref }) => ({ name, detail, ref })),
  };
};

/** Historique d'exercices, sans la séance `exclude` (celle qu'on termine). */
async function historyOf(
  userId: string,
  exercises: readonly WorkoutExercise[],
  exclude: string | null,
): Promise<Map<string, Pick<ExerciseHistory, "last" | "best">>> {
  const refs = exercises
    .map((exercise) => exercise.ref)
    .filter((ref): ref is string => uuid.safeParse(ref).success);
  const names = exercises.map((exercise) => exercise.name);
  const rows = await db.workoutSet.findMany({
    where: {
      done: true,
      OR: [{ libraryItemId: { in: refs } }, { exercise: { in: names } }],
      session: {
        userId,
        finishedAt: { not: null },
        ...(exclude ? { id: { not: exclude } } : {}),
      },
    },
    orderBy: [
      { session: { day: "desc" } },
      { session: { startedAt: "desc" } },
      { setNumber: "asc" },
    ],
    take: 3000,
    select: {
      sessionId: true,
      exercise: true,
      libraryItemId: true,
      setNumber: true,
      weightGrams: true,
      reps: true,
      seconds: true,
      session: { select: { day: true } },
    },
  });
  return new Map(
    exercises.map((exercise) => [
      exerciseKey(exercise),
      historyFromRows(
        rows
          .filter(
            (row) =>
              (exercise.ref !== null && row.libraryItemId === exercise.ref) ||
              row.exercise === exercise.name,
          )
          .map((row) => ({
            sessionId: row.sessionId,
            day: fromDbDate(row.session.day),
            setNumber: row.setNumber,
            weightGrams: row.weightGrams,
            reps: row.reps,
            seconds: row.seconds,
          })),
      ),
    ]),
  );
}

/** Records d'une séance par rapport à toutes les précédentes. */
async function recordsOf(
  userId: string,
  sessionId: string,
  exercises: readonly WorkoutExercise[],
  sets: readonly SetLog[],
) {
  const history = await historyOf(userId, exercises, sessionId);
  return findRecords(
    exercises.map((exercise, position) => ({
      position,
      name: exercise.name,
      previousBest: (history.get(exerciseKey(exercise))?.best ??
        null) as SetValues | null,
    })),
    sets,
  );
}

/**
 * Séances oubliées d'un jour passé : terminées à leur dernière série s'il y en
 * a une de faite (la personne a oublié de toucher « Terminer »), effacées sinon.
 */
async function settleForgotten(userId: string, today: string) {
  const forgotten = await db.workoutSession.findMany({
    where: { userId, finishedAt: null, day: { lt: toDbDate(today) } },
    select: {
      id: true,
      startedAt: true,
      exercises: true,
      sets: { select: { ...setSelect, updatedAt: true } },
    },
  });
  for (const session of forgotten) {
    const done = session.sets.filter((set) => set.done);
    if (done.length === 0) {
      await db.workoutSession.deleteMany({ where: { id: session.id, userId } });
      continue;
    }
    const last = Math.max(...done.map((set) => set.updatedAt.getTime()));
    await db.workoutSession.updateMany({
      where: { id: session.id, userId },
      data: {
        finishedAt: new Date(Math.max(last, session.startedAt.getTime())),
        records: await recordsOf(
          userId,
          session.id,
          readExercises(session.exercises),
          session.sets,
        ),
      },
    });
  }
}

/**
 * Pour la page d'un plan d'entraînement : l'unité, les séances de la semaine et
 * l'historique des exercices du plan. Le carnet démarre ainsi sans réseau.
 */
export async function getWorkoutPage(
  userId: string,
  plan: DevelopmentPlan,
): Promise<WorkoutPageData> {
  const settings = await db.userSettings.findUnique({
    where: { userId },
    select: { timeZone: true, weightUnit: true },
  });
  const today = toCalendarDay(
    new Date(),
    settings?.timeZone ?? "America/Toronto",
  );
  await settleForgotten(userId, today);
  const days = weekOf(today);
  const sessions = await db.workoutSession.findMany({
    where: {
      userId,
      day: {
        gte: toDbDate(days[0] ?? today),
        lte: toDbDate(days[6] ?? today),
      },
    },
    orderBy: { startedAt: "asc" },
    select: {
      day: true,
      weekday: true,
      title: true,
      startedAt: true,
      finishedAt: true,
      feeling: true,
      exercises: true,
      records: true,
      sets: {
        select: setSelect,
        orderBy: [{ position: "asc" }, { setNumber: "asc" }],
      },
    },
  });
  const rows: WorkoutSessionRow[] = sessions.map((session) => {
    const records = workoutRecordsSchema.safeParse(session.records);
    return {
      day: fromDbDate(session.day),
      weekday: session.weekday,
      title: session.title,
      startedAt: session.startedAt.toISOString(),
      finishedAt: session.finishedAt?.toISOString() ?? null,
      feeling: session.feeling,
      exercises: readExercises(session.exercises),
      records: records.success ? records.data : [],
      sets: session.sets,
    };
  });

  // Exercices du plan et de ses séances déjà commencées (figés, ils peuvent différer)
  const exercises = [
    ...plan.schedule.flatMap((session) => session.items),
    ...rows.flatMap((row) => row.exercises),
  ].map(({ name, detail, ref }) => ({ name, detail, ref }));
  const unique = [
    ...new Map(exercises.map((item) => [exerciseKey(item), item])).values(),
  ];
  const refs = unique
    .map((item) => item.ref)
    .filter((ref): ref is string => uuid.safeParse(ref).success);
  const [history, items] = await Promise.all([
    historyOf(userId, unique, null),
    refs.length > 0
      ? db.libraryItem.findMany({
          where: { id: { in: refs } },
          select: { id: true, tags: true },
        })
      : [],
  ]);
  const tags = new Map(items.map((item) => [item.id, item.tags]));

  return {
    ownerId: userId,
    unit: WEIGHT_UNITS.find((unit) => unit === settings?.weightUnit) ?? null,
    sessions: rows,
    history: Object.fromEntries(
      unique.map((item) => {
        const key = exerciseKey(item);
        return [
          key,
          {
            loaded: isLoaded(item.ref ? (tags.get(item.ref) ?? null) : null),
            last: history.get(key)?.last ?? null,
            best: history.get(key)?.best ?? null,
          },
        ];
      }),
    ),
  };
}

/** Le plan d'entraînement enregistré de la personne. */
async function trainingPlan(userId: string) {
  const row = await db.developmentPlan.findUnique({
    where: { userId_kind: { userId, kind: "physical" } },
    select: { id: true, plan: true },
  });
  const plan = row ? storedPlanSchema.safeParse(row.plan) : null;
  return row && plan?.success ? { id: row.id, plan: plan.data } : null;
}

export type WorkoutResult = { ok: true } | { ok: false; error: WorkoutError };

/**
 * Reçoit ce que le téléphone a noté. La séance se retrouve par son jour et le
 * jour de la semaine type : renvoyer deux fois la même chose ne change rien
 * (le réseau du gym peut couper en plein envoi). Sans série ni « Terminer »,
 * rien n'est créé : ouvrir le carnet sans rien noter ne laisse pas de trace.
 */
export async function syncWorkout(
  userId: string,
  input: WorkoutSync,
): Promise<WorkoutResult> {
  const now = new Date();
  const today = toCalendarDay(now, await getUserTimeZone(userId));
  const age = daysBetween(input.day, today);
  if (age < 0 || age > WORKOUT_DAYS_BACK) {
    return { ok: false, error: "dayInvalid" };
  }

  const where = {
    userId_day_weekday: {
      userId,
      day: toDbDate(input.day),
      weekday: input.weekday,
    },
  };
  const existing = await db.workoutSession.findUnique({
    where,
    select: { id: true, exercises: true, startedAt: true },
  });
  if (
    !existing &&
    input.sets.length === 0 &&
    input.removed.length === 0 &&
    !input.finish
  ) {
    return { ok: true };
  }

  let exercises: WorkoutExercise[];
  let created: { planId: string; title: string } | null = null;
  if (existing) {
    exercises = readExercises(existing.exercises);
  } else {
    const stored = await trainingPlan(userId);
    if (!stored) return { ok: false, error: "noPlan" };
    const session = exercisesOfPlan(stored.plan, input.weekday);
    if (!session) return { ok: false, error: "sessionMissing" };
    exercises = session.exercises;
    created = { planId: stored.id, title: session.title };
  }

  // Une date venue du téléphone reste dans ce qui est possible
  const earliest = addDays(input.day, -1);
  const startedAt = new Date(
    Math.min(
      Math.max(
        new Date(input.startedAt).getTime(),
        toDbDate(earliest).getTime(),
      ),
      now.getTime(),
    ),
  );

  const refs = exercises
    .map((exercise) => exercise.ref)
    .filter((ref): ref is string => uuid.safeParse(ref).success);
  const known = new Set(
    (
      await db.libraryItem.findMany({
        where: { id: { in: refs } },
        select: { id: true },
      })
    ).map((item) => item.id),
  );

  const session = await db.$transaction(async (tx) => {
    const row =
      existing ??
      (await tx.workoutSession.upsert({
        where,
        update: {},
        create: {
          userId,
          planId: created?.planId ?? null,
          day: toDbDate(input.day),
          weekday: input.weekday,
          title: created?.title ?? "",
          exercises,
          startedAt,
        },
        select: { id: true, exercises: true, startedAt: true },
      }));
    for (const set of input.sets) {
      const exercise = exercises[set.position];
      if (!exercise) continue;
      const values = {
        weightGrams: set.weightGrams,
        reps: set.reps,
        seconds: set.seconds,
        done: set.done,
      };
      await tx.workoutSet.upsert({
        where: {
          sessionId_position_setNumber: {
            sessionId: row.id,
            position: set.position,
            setNumber: set.setNumber,
          },
        },
        update: values,
        create: {
          sessionId: row.id,
          position: set.position,
          setNumber: set.setNumber,
          exercise: exercise.name,
          libraryItemId:
            exercise.ref && known.has(exercise.ref) ? exercise.ref : null,
          ...values,
        },
      });
    }
    if (input.removed.length > 0) {
      await tx.workoutSet.deleteMany({
        where: {
          sessionId: row.id,
          OR: input.removed.map(({ position, setNumber }) => ({
            position,
            setNumber,
          })),
        },
      });
    }
    return row;
  });

  if (!input.finish) return { ok: true };

  const sets = await db.workoutSet.findMany({
    where: { sessionId: session.id },
    select: setSelect,
  });
  // « Terminer » demande au moins une série faite (décision du fondateur)
  if (!sets.some((set) => set.done)) {
    return { ok: false, error: "noSetDone" };
  }
  await db.workoutSession.updateMany({
    where: { id: session.id, userId },
    data: {
      finishedAt: new Date(
        Math.min(
          Math.max(
            new Date(input.finish.finishedAt).getTime(),
            session.startedAt.getTime(),
          ),
          now.getTime(),
        ),
      ),
      feeling: input.finish.feeling,
      records: await recordsOf(userId, session.id, exercises, sets),
    },
  });
  return { ok: true };
}

/** « Continuer la séance » : le jour même, elle redevient en cours. */
export async function reopenWorkout(
  userId: string,
  day: string,
  weekday: number,
) {
  const today = toCalendarDay(new Date(), await getUserTimeZone(userId));
  if (day !== today) return false;
  const { count } = await db.workoutSession.updateMany({
    where: { userId, day: toDbDate(day), weekday },
    data: { finishedAt: null, feeling: null, records: [] },
  });
  return count > 0;
}

/** Supprime une séance et ses séries. */
export async function deleteWorkout(
  userId: string,
  day: string,
  weekday: number,
) {
  const { count } = await db.workoutSession.deleteMany({
    where: { userId, day: toDbDate(day), weekday },
  });
  return count > 0;
}

/** Unité choisie à la première séance, ou changée pendant une séance. */
export async function setWeightUnit(userId: string, unit: WeightUnit) {
  await db.userSettings.updateMany({
    where: { userId },
    data: { weightUnit: unit },
  });
}
