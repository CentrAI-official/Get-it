import { z } from "zod";
import { DEVELOPMENT_PLAN_LIMITS } from "@/features/development/plan";
import { parseAmount } from "@/features/budget/rules";

// Cocher un élément d'un plan de nutrition, mental, social ou financier
// (décision du fondateur, 2026-11-03). Limites alignées sur la migration
// 20261117120000_plan_item_logs (un test le vérifie). Le plan d'entraînement a
// son carnet : voir src/features/workouts.

export const LOGGED_KINDS = [
  "nutrition",
  "mental",
  "social",
  "financial",
] as const;
export type LoggedKind = (typeof LOGGED_KINDS)[number];

export const isLoggedKind = (kind: string): kind is LoggedKind =>
  LOGGED_KINDS.some((entry) => entry === kind);

export const PLAN_LOG_LIMITS = {
  /** Nom figé de l'élément (les noms du plan sont plus courts). */
  item: 200,
  /** « Remplacé par… » */
  replacedBy: 120,
  positions: DEVELOPMENT_PLAN_LIMITS.itemsPerDay,
} as const;

/** Comment s'est passé un défi social : difficile, correct, super bien. */
export const OUTCOMES = [1, 2, 3] as const;
export type Outcome = (typeof OUTCOMES)[number];

/** Comme les habitudes : aujourd'hui et les 6 jours précédents. */
export const PLAN_LOG_DAYS_BACK = 6;

export type PlanLogRow = {
  day: string;
  weekday: number;
  position: number;
  item: string;
  replacedBy: string | null;
  outcome: number | null;
  /** Le montant ajouté au budget, s'il y en a un. */
  budgetCents: number | null;
};

export type PlanLogPage = {
  /** Éléments cochés de la semaine en cours. */
  rows: PlanLogRow[];
  currency: "CAD" | "USD";
  /** Durée des fiches du catalogue du plan, pour le minuteur (mental). */
  minutes: Record<string, number>;
};

export type PlanLogError =
  | "invalid"
  | "dayInvalid"
  | "notFound"
  | "amountInvalid"
  | "entryLimit"
  | "unexpected";

const target = {
  kind: z.enum(LOGGED_KINDS),
  day: z.iso.date(),
  weekday: z.number().int().min(1).max(7),
  position: z
    .number()
    .int()
    .min(0)
    .max(PLAN_LOG_LIMITS.positions - 1),
};

/** Coche, décoche ou précise un élément. Le nom vient du plan, jamais d'ici. */
export const planLogSchema = z.strictObject({
  ...target,
  done: z.boolean(),
  replacedBy: z
    .string()
    .trim()
    .min(1)
    .max(PLAN_LOG_LIMITS.replacedBy)
    .nullable(),
  outcome: z
    .number()
    .int()
    .min(OUTCOMES[0])
    .max(OUTCOMES[OUTCOMES.length - 1] ?? 3)
    .nullable(),
});
export type PlanLogInput = z.output<typeof planLogSchema>;

const budgetTarget = { ...target, kind: z.literal("financial") };

/** « Ajouter au budget » : un clic explicite, avec le montant tapé. */
export const planBudgetSchema = z.strictObject({
  ...budgetTarget,
  amount: z.string().max(40),
});
export const planBudgetTargetSchema = z.strictObject(budgetTarget);
export type PlanBudgetTarget = z.output<typeof planBudgetTargetSchema>;

/** Le jour où noter : aujourd'hui pour une séance à venir faite d'avance. */
export const logDayOf = (day: string, today: string) =>
  day > today ? today : day;

/**
 * La ligne d'un élément. Le nom compte aussi : si le plan a changé depuis, un
 * autre élément à cette place n'est pas déjà coché.
 */
export function findLog(
  rows: readonly PlanLogRow[],
  day: string,
  weekday: number,
  position: number,
  name: string,
) {
  return (
    rows.find(
      (row) =>
        row.day === day &&
        row.weekday === weekday &&
        row.position === position &&
        row.item === name.slice(0, PLAN_LOG_LIMITS.item),
    ) ?? null
  );
}

/** Applique un changement à la liste, pour l'afficher avant la réponse du serveur. */
export function applyLogChange(
  rows: readonly PlanLogRow[],
  change: PlanLogInput & { name: string },
): PlanLogRow[] {
  const others = rows.filter(
    (row) =>
      !(
        row.day === change.day &&
        row.weekday === change.weekday &&
        row.position === change.position
      ),
  );
  if (!change.done) return others;
  const previous = rows.find((row) => !others.includes(row));
  return [
    ...others,
    {
      day: change.day,
      weekday: change.weekday,
      position: change.position,
      item: change.name.slice(0, PLAN_LOG_LIMITS.item),
      replacedBy: change.replacedBy,
      outcome: change.outcome,
      budgetCents: previous?.budgetCents ?? null,
    },
  ];
}

/** Combien d'éléments d'une séance sont faits ce jour-là. */
export function sessionProgress(
  rows: readonly PlanLogRow[],
  session: { weekday: number; items: readonly { name: string }[] },
  day: string,
) {
  const done = session.items.filter(
    (item, position) =>
      findLog(rows, day, session.weekday, position, item.name) !== null,
  ).length;
  return { done, total: session.items.length };
}

// Pratique guidée (mental)

export const DEFAULT_PRACTICE_MINUTES = 5;
export const DEFAULT_BREATH_MINUTES = 2;
export const PRACTICE_MINUTES_MAX = 60;

/** Rythme de respiration, en secondes ; un temps à 0 n'existe pas. */
export type BreathPattern = {
  inhale: number;
  hold: number;
  exhale: number;
  rest: number;
};
export type BreathPhase = keyof BreathPattern;

const FOUR_SEVEN_EIGHT = { inhale: 4, hold: 7, exhale: 8, rest: 0 };
const BOX = { inhale: 4, hold: 4, exhale: 4, rest: 4 };
const COHERENCE = { inhale: 5, hold: 0, exhale: 5, rest: 0 };

/** Durée écrite dans une pratique (« 10 minutes », « 5 min ») ; null sinon. */
export function practiceMinutes(text: string): number | null {
  const match = /(\d{1,3})\s*(?:minutes?|mins?|mn)\b/i.exec(text);
  const minutes = match ? Number(match[1]) : null;
  return minutes && minutes <= PRACTICE_MINUTES_MAX ? minutes : null;
}

/**
 * Une pratique de respiration et son rythme : celui qui est écrit (« 4-7-8 »,
 * « 5-5 »), sinon celui de son nom ; le 4-7-8 par défaut. Null si ce n'en est
 * pas une.
 */
export function breathPatternOf(text: string): BreathPattern | null {
  if (!/respir|souffl|breath|cohérence|coherence/i.test(text)) return null;
  // Pas une durée : « 5-10 minutes » n'est pas un rythme
  const written =
    /\b(\d{1,2})\s*[-–—/]\s*(\d{1,2})(?:\s*[-–—/]\s*(\d{1,2}))?(?:\s*[-–—/]\s*(\d{1,2}))?\b(?!\s*(?:minutes?|mins?|mn|s\b|sec|fois|times?))/i.exec(
      text,
    );
  if (written) {
    const values = written
      .slice(1)
      .filter((value) => value !== undefined)
      .map(Number);
    if (values.every((value) => value >= 1 && value <= 12)) {
      const [first = 4, second = 0, third, fourth = 0] = values;
      return third === undefined
        ? { inhale: first, hold: 0, exhale: second, rest: 0 }
        : { inhale: first, hold: second, exhale: third, rest: fourth };
    }
  }
  if (/carrée|carree|\bbox\b|square/i.test(text)) return BOX;
  if (/cohérence|coherence/i.test(text)) return COHERENCE;
  return FOUR_SEVEN_EIGHT;
}

/** « 4-7-8 », pour l'afficher. */
export const breathLabel = (pattern: BreathPattern) =>
  [pattern.inhale, pattern.hold, pattern.exhale, pattern.rest]
    .filter((seconds) => seconds > 0)
    .join("-");

const BREATH_PHASES: readonly BreathPhase[] = [
  "inhale",
  "hold",
  "exhale",
  "rest",
];

/**
 * Où en est la respiration après `elapsed` secondes : le temps en cours, ce
 * qu'il en reste et la taille du cercle (0 : poumons vides, 1 : pleins).
 */
export function breathAt(pattern: BreathPattern, elapsed: number) {
  const cycle =
    pattern.inhale + pattern.hold + pattern.exhale + pattern.rest || 1;
  let cursor = Math.max(0, elapsed) % cycle;
  for (const phase of BREATH_PHASES) {
    const length = pattern[phase];
    if (cursor < length) {
      const progress = cursor / length;
      return {
        phase,
        left: Math.ceil(length - cursor),
        fill:
          phase === "inhale"
            ? progress
            : phase === "hold"
              ? 1
              : phase === "exhale"
                ? 1 - progress
                : 0,
      };
    }
    cursor -= length;
  }
  return { phase: "inhale" as BreathPhase, left: pattern.inhale, fill: 0 };
}

// Action financière

const SAVINGS_WORDS =
  /épargn|epargn|virement|\bvire[rz]?\b|mets? de côté|mettre de côté|\bceli(app)?\b|\breer\b|saving|\bsave\b|set aside|transfer|\btfsa\b|\brrsp\b|\bfhsa\b/i;

/**
 * Une action d'épargne, et son montant s'il est écrit (« Virer 50 $ ») : elle
 * peut s'ajouter au budget. Null pour les autres actions.
 */
export function savingsActionOf(text: string): { cents: number | null } | null {
  if (!SAVINGS_WORDS.test(text)) return null;
  const match =
    /(\d[\d\s  .,]*)\s*\$/.exec(text) ?? /\$\s*(\d[\d.,]*)/.exec(text);
  return { cents: match?.[1] ? parseAmount(match[1]) : null };
}
