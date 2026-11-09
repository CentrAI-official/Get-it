import "server-only";
import { getFormatter, getTranslations } from "next-intl/server";
import {
  factorPillar,
  factorValue,
  LEVEL_PILLARS,
  measureAnswersSchema,
  measureAvailableAt,
  measureCorrectableUntil,
  PILLAR_FACTORS,
  type LevelFactor,
  type LevelPillar,
} from "@/features/levels/factors";
import { levelGoalTitle } from "@/features/levels/format";
import {
  factorLevel,
  nextLevelGoals,
  pillarLevel,
  totalLevel,
  type LevelGoal,
  type LevelPerson,
} from "@/features/levels/scale";
import { ageOn } from "@/features/profile/details";
import { WEIGHT_UNITS, type WeightUnit } from "@/features/workouts/rules";
import { fromDbDate, toCalendarDay } from "@/lib/dates";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { getRankedPerson } from "@/server/profile/details";
import { getUserTimeZone } from "@/server/profile/service";

// Niveaux mesurés (décision du fondateur, 2026-11-01). Chaque fonction reçoit
// l'userId de la session. Les mesures (revenu, patrimoine, tests) restent
// privées ; les niveaux ne se montrent aux autres qu'en Ranked (`rankedAt`).
// Le calcul vient des tableaux de population (src/features/levels/scale.ts),
// jamais de l'IA.

type Tx = Prisma.TransactionClient;

export type FactorState = {
  factor: LevelFactor;
  /** Dernière valeur mesurée (unité de la mesure), ou null. */
  value: number | null;
  level: number | null;
  /** « AAAA-MM-JJTHH:MM:SS.sssZ » de la dernière mesure. */
  measuredAt: string | null;
  /** Quand la mesure pourra être refaite ; null : tout de suite. */
  availableAt: string | null;
  /** Jusqu'à quand la dernière mesure peut être corrigée (48 h) ; null : plus maintenant. */
  correctableUntil: string | null;
};

export type PillarState = {
  pillar: LevelPillar;
  /** Niveau de la mesure la plus faible ; null tant qu'une mesure manque. */
  level: number | null;
  factors: FactorState[];
  /** Ce qu'il faut atteindre pour le niveau suivant. */
  next: LevelGoal[];
};

export type LevelState = {
  /** Âge, sexe et pays du compte ; null s'il manque un renseignement. */
  person: LevelPerson | null;
  pillars: Record<LevelPillar, PillarState>;
  total: number | null;
  /** Mode Ranked : niveaux publics depuis ce moment. */
  rankedAt: string | null;
  /** Poids du corps de la dernière mesure du développé couché. */
  weightKg: number | null;
  /** Unité des poids choisie (carnet d'entraînement ou Ranked). */
  weightUnit: WeightUnit;
};

/** Résumé des niveaux d'une personne (fiche du Profil, coach, classement). */
export type Levels = {
  physical: number | null;
  financial: number | null;
  total: number | null;
  ranked: boolean;
};

type LatestMeasure = {
  id: string;
  factor: string;
  value: number;
  measuredAt: Date;
  details: Prisma.JsonValue;
};

/** Dernière mesure de chaque facteur, pour une ou plusieurs personnes. */
async function latestMeasures(client: Tx | typeof db, userIds: string[]) {
  const rows = await client.measurement.findMany({
    where: { userId: { in: userIds } },
    orderBy: [{ userId: "asc" }, { factor: "asc" }, { measuredAt: "desc" }],
    distinct: ["userId", "factor"],
    select: {
      id: true,
      userId: true,
      factor: true,
      value: true,
      measuredAt: true,
      details: true,
    },
  });
  const byUser = new Map<string, Map<LevelFactor, LatestMeasure>>();
  for (const row of rows) {
    const measures = byUser.get(row.userId) ?? new Map();
    measures.set(row.factor as LevelFactor, row);
    byUser.set(row.userId, measures);
  }
  return byUser;
}

const weightOf = (measure: LatestMeasure | undefined) => {
  const details = measure?.details;
  if (!details || typeof details !== "object" || Array.isArray(details)) {
    return null;
  }
  const weight = (details as Record<string, unknown>).weightKg;
  return typeof weight === "number" ? weight : null;
};

/** État des niveaux à partir des dernières mesures. */
function buildState(
  person: LevelPerson | null,
  measures: Map<LevelFactor, LatestMeasure>,
  rankedAt: Date | null,
  weightUnit: WeightUnit = "kg",
): LevelState {
  const pillars = Object.fromEntries(
    LEVEL_PILLARS.map((pillar): [LevelPillar, PillarState] => {
      const factors = PILLAR_FACTORS[pillar].map((factor): FactorState => {
        const measure = measures.get(factor);
        const availableAt = measureAvailableAt(
          factor,
          measure?.measuredAt ?? null,
        );
        const correctable = measure
          ? measureCorrectableUntil(measure.measuredAt)
          : null;
        return {
          factor,
          value: measure?.value ?? null,
          level:
            measure && person
              ? factorLevel(factor, measure.value, person)
              : null,
          measuredAt: measure?.measuredAt.toISOString() ?? null,
          availableAt:
            availableAt && availableAt.getTime() > Date.now()
              ? availableAt.toISOString()
              : null,
          correctableUntil:
            correctable && correctable.getTime() > Date.now()
              ? correctable.toISOString()
              : null,
        };
      });
      const levels = Object.fromEntries(
        factors.map((factor) => [factor.factor, factor.level]),
      );
      return [
        pillar,
        {
          pillar,
          level: pillarLevel(factors.map((factor) => factor.level)),
          factors,
          next: person ? nextLevelGoals(pillar, levels, person) : [],
        },
      ];
    }),
  ) as Record<LevelPillar, PillarState>;
  return {
    person,
    pillars,
    total: totalLevel(pillars.physical.level, pillars.financial.level),
    rankedAt: rankedAt?.toISOString() ?? null,
    weightKg: weightOf(measures.get("bench")),
    weightUnit,
  };
}

const unitOf = (value: string | null | undefined): WeightUnit =>
  WEIGHT_UNITS.find((unit) => unit === value) ?? "kg";

/** Niveaux, mesures et prochains objectifs de la personne elle-même. */
export async function getLevelState(userId: string): Promise<LevelState> {
  const timeZone = await getUserTimeZone(userId);
  const [person, measures, profile, settings] = await Promise.all([
    getRankedPerson(userId, timeZone),
    latestMeasures(db, [userId]),
    db.profile.findUnique({
      where: { id: userId },
      select: { rankedAt: true },
    }),
    db.userSettings.findUnique({
      where: { userId },
      select: { weightUnit: true },
    }),
  ]);
  return buildState(
    person,
    measures.get(userId) ?? new Map(),
    profile?.rankedAt ?? null,
    unitOf(settings?.weightUnit),
  );
}

/** Résumé des niveaux de la personne elle-même. */
export async function getMyLevels(userId: string): Promise<Levels> {
  const state = await getLevelState(userId);
  return {
    physical: state.pillars.physical.level,
    financial: state.pillars.financial.level,
    total: state.total,
    ranked: state.rankedAt !== null,
  };
}

/**
 * Niveaux de plusieurs personnes (classement, fil, profils publics) : l'âge
 * est calculé dans le fuseau de chacune. `rankedOnly` : seulement celles qui
 * ont rendu leurs niveaux publics.
 */
export async function levelsOf(
  userIds: string[],
  { rankedOnly }: { rankedOnly: boolean },
): Promise<Map<string, Levels & { rankedAt: Date | null }>> {
  const result = new Map<string, Levels & { rankedAt: Date | null }>();
  if (userIds.length === 0) return result;
  const profiles = await db.profile.findMany({
    where: {
      id: { in: userIds },
      ...(rankedOnly ? { rankedAt: { not: null } } : {}),
    },
    select: {
      id: true,
      birthDate: true,
      sex: true,
      country: true,
      rankedAt: true,
      settings: { select: { timeZone: true } },
    },
  });
  const measures = await latestMeasures(
    db,
    profiles.map((profile) => profile.id),
  );
  const now = new Date();
  for (const profile of profiles) {
    const person: LevelPerson | null =
      profile.birthDate && profile.sex && profile.country
        ? {
            age: ageOn(
              fromDbDate(profile.birthDate),
              toCalendarDay(now, profile.settings?.timeZone ?? "UTC"),
            ),
            sex: profile.sex,
            country: profile.country,
          }
        : null;
    const state = buildState(
      person,
      measures.get(profile.id) ?? new Map(),
      profile.rankedAt,
    );
    result.set(profile.id, {
      physical: state.pillars.physical.level,
      financial: state.pillars.financial.level,
      total: state.total,
      ranked: profile.rankedAt !== null,
      rankedAt: profile.rankedAt,
    });
  }
  return result;
}

/**
 * Niveau montré aux autres (fil, Messagerie, contacts) : le total des
 * personnes en Ranked dont les deux piliers sont mesurés ; sinon, rien.
 */
export async function getDisplayLevels(userIds: string[]) {
  const levels = await levelsOf([...new Set(userIds)], { rankedOnly: true });
  const display = new Map<string, number>();
  for (const [id, level] of levels) {
    if (level.total !== null) display.set(id, level.total);
  }
  return display;
}

/** Niveaux publics d'une personne (profil public), ou null hors Ranked. */
export async function getPublicLevels(userId: string) {
  const level = (await levelsOf([userId], { rankedOnly: true })).get(userId);
  if (!level || level.total === null) return null;
  return {
    physical: level.physical as number,
    financial: level.financial as number,
    total: level.total,
  };
}

export const LEVEL_ERRORS = [
  "invalid",
  "detailsMissing",
  "consentRequired",
  "tooSoon",
  "tooLateToCorrect",
  "unexpected",
] as const;
export type LevelError = (typeof LEVEL_ERRORS)[number];

export type RecordResult =
  | {
      ok: true;
      /** Niveau du pilier avant et après (null : pas encore mesuré). */
      before: number | null;
      after: number | null;
    }
  | { ok: false; error: LevelError };

/**
 * Enregistre une ou plusieurs mesures d'un même pilier (première évaluation,
 * ou une mesure refaite), puis met à jour les objectifs de niveau dans la
 * même transaction. La première mesure d'un pilier demande l'accord (Loi 25).
 * `correct` : remplace la dernière mesure (faute de saisie), dans les 48 h.
 */
export async function recordMeasurements(
  userId: string,
  input: {
    factors: LevelFactor[];
    answers: Record<string, unknown>;
    consent: boolean;
    correct?: boolean;
  },
): Promise<RecordResult> {
  const parsed = measureAnswersSchema(input.factors).safeParse(input.answers);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const pillar = factorPillar(input.factors[0] as LevelFactor);
  const timeZone = await getUserTimeZone(userId);
  const person = await getRankedPerson(userId, timeZone);
  if (!person) return { ok: false, error: "detailsMissing" };

  const before = await getLevelState(userId);
  const measured = before.pillars[pillar].factors.some(
    (factor) => factor.value !== null,
  );
  if (!measured && !input.consent) {
    return { ok: false, error: "consentRequired" };
  }
  const states = input.factors.map((factor) =>
    before.pillars[pillar].factors.find((state) => state.factor === factor),
  );
  if (input.correct) {
    // Corriger : seulement une mesure faite il y a moins de 48 h
    if (states.some((state) => !state?.correctableUntil)) {
      return { ok: false, error: "tooLateToCorrect" };
    }
  } else if (states.some((state) => (state?.availableAt ?? null) !== null)) {
    return { ok: false, error: "tooSoon" };
  }

  const settings = await db.userSettings.findUnique({
    where: { userId },
    select: { locale: true, weightUnit: true },
  });
  const locale = settings?.locale ?? "fr";
  // L'unité choisie pour le développé couché devient celle du carnet
  const weightUnit =
    "weightUnit" in parsed.data && parsed.data.weightUnit
      ? parsed.data.weightUnit
      : unitOf(settings?.weightUnit);
  const [t, format] = await Promise.all([
    getTranslations({ locale, namespace: "Levels.goals" }),
    getFormatter({ locale }),
  ]);

  const after = await db.$transaction(async (tx) => {
    if (input.correct) {
      // La dernière mesure de chaque facteur est remplacée, à la même date
      const latest = (await latestMeasures(tx, [userId])).get(userId);
      for (const factor of input.factors) {
        const measure = latest?.get(factor);
        if (!measure) continue;
        const { value, details } = factorValue(factor, parsed.data);
        await tx.measurement.update({
          where: { id: measure.id },
          data: { value, details },
        });
      }
    } else {
      await tx.measurement.createMany({
        data: input.factors.map((factor) => {
          const { value, details } = factorValue(factor, parsed.data);
          return { userId, factor, value, details };
        }),
      });
    }
    if (weightUnit !== unitOf(settings?.weightUnit)) {
      await tx.userSettings.updateMany({
        where: { userId },
        data: { weightUnit },
      });
    }
    const state = buildState(
      person,
      (await latestMeasures(tx, [userId])).get(userId) ?? new Map(),
      null,
      weightUnit,
    );
    await syncLevelGoals(tx, userId, state, (factor, target) =>
      levelGoalTitle(
        t as unknown as Parameters<typeof levelGoalTitle>[0],
        format,
        factor,
        target,
        {
          country: person.country,
          sex: person.sex,
          weightKg: state.weightKg,
          weightUnit,
        },
      ),
    );
    return state.pillars[pillar].level;
  });
  return { ok: true, before: before.pillars[pillar].level, after };
}

/**
 * Objectifs de niveau d'après l'état des mesures : un objectif atteint est
 * marqué atteint ; chaque mesure sous le seuil suivant a un objectif en cours
 * avec sa valeur fixe (créé, ou mis à jour s'il a changé) ; un objectif qui ne
 * correspond plus à rien (le niveau a baissé ailleurs) est mis de côté.
 */
async function syncLevelGoals(
  tx: Tx,
  userId: string,
  state: LevelState,
  title: (factor: LevelFactor, target: number) => string,
) {
  const active = await tx.goal.findMany({
    where: { userId, kind: "level", status: "active" },
    select: {
      id: true,
      levelFactor: true,
      levelTarget: true,
      level: true,
      title: true,
    },
  });
  const levels = new Map(
    LEVEL_PILLARS.flatMap((pillar) =>
      state.pillars[pillar].factors.map(
        (factor) => [factor.factor, factor.level] as const,
      ),
    ),
  );
  const wanted = new Map(
    LEVEL_PILLARS.flatMap((pillar) =>
      state.pillars[pillar].next.map((goal) => [goal.factor, goal] as const),
    ),
  );
  const now = new Date();

  for (const goal of active) {
    const factor = goal.levelFactor as LevelFactor;
    const level = levels.get(factor) ?? null;
    const next = wanted.get(factor);
    if (level !== null && goal.level !== null && level >= goal.level) {
      await tx.goal.update({
        where: { id: goal.id },
        data: { status: "completed", completedAt: now },
      });
    } else if (next) {
      // Le titre suit aussi l'unité des poids (kg ou lb)
      const wantedTitle = title(factor, next.target);
      if (
        next.target !== goal.levelTarget ||
        next.level !== goal.level ||
        wantedTitle !== goal.title
      ) {
        await tx.goal.update({
          where: { id: goal.id },
          data: {
            levelTarget: next.target,
            level: next.level,
            title: wantedTitle,
          },
        });
      }
      wanted.delete(factor);
    } else {
      await tx.goal.update({
        where: { id: goal.id },
        data: { status: "archived" },
      });
    }
  }
  // Les objectifs atteints libèrent leur place : on crée ceux qui manquent
  for (const goal of wanted.values()) {
    await tx.goal.create({
      data: {
        userId,
        kind: "level",
        levelFactor: goal.factor,
        levelTarget: goal.target,
        level: goal.level,
        title: title(goal.factor, goal.target),
        pillar: factorPillar(goal.factor),
      },
    });
  }
}

/** Mode Ranked : rendre ses niveaux publics (et paraître au classement), ou non. */
export async function setRanked(userId: string, ranked: boolean) {
  await db.profile.update({
    where: { id: userId },
    data: { rankedAt: ranked ? new Date() : null },
  });
}

/**
 * Efface toutes les mesures (Loi 25) : les niveaux disparaissent, les
 * objectifs de niveau en cours sont supprimés et le mode Ranked se ferme.
 */
export async function eraseLevels(userId: string) {
  await db.$transaction([
    db.measurement.deleteMany({ where: { userId } }),
    db.goal.deleteMany({ where: { userId, kind: "level", status: "active" } }),
    db.profile.update({ where: { id: userId }, data: { rankedAt: null } }),
  ]);
}
