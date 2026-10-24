import { z } from "zod";
import { addDays, daysBetween, isoWeekday } from "@/lib/dates";

// Journal : une page par jour, privée. Fonctions pures, testées dans
// rules.test.ts ; les limites sont aussi des contraintes de la migration.

/** Questions guidées de chaque page, dans l'ordre d'affichage. */
export const JOURNAL_PROMPTS = [
  "gratitude",
  "win",
  "lesson",
  "intention",
] as const;
export type JournalPrompt = (typeof JOURNAL_PROMPTS)[number];

export const JOURNAL_PROMPT_MAX_LENGTH = 500;
export const JOURNAL_BODY_MAX_LENGTH = 5000;
/** Une page se modifie le jour même et pendant les 7 jours suivants. */
export const JOURNAL_EDITABLE_PAST_DAYS = 7;

export const JOURNAL_PERIODS = ["week", "month"] as const;
export type JournalPeriod = (typeof JOURNAL_PERIODS)[number];

export type JournalText = Record<JournalPrompt | "body", string | null>;

/** Réponse facultative : une chaîne vide (ou d'espaces) devient null. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .default(null);

export const journalEntrySchema = z.object({
  day: z.iso.date(),
  gratitude: optionalText(JOURNAL_PROMPT_MAX_LENGTH),
  win: optionalText(JOURNAL_PROMPT_MAX_LENGTH),
  lesson: optionalText(JOURNAL_PROMPT_MAX_LENGTH),
  intention: optionalText(JOURNAL_PROMPT_MAX_LENGTH),
  body: optionalText(JOURNAL_BODY_MAX_LENGTH),
});
export type JournalEntryInput = z.infer<typeof journalEntrySchema>;

/** Page sans aucun texte : elle n'est pas enregistrée (ou est retirée). */
export function isEmptyEntry(entry: JournalText) {
  return [...JOURNAL_PROMPTS, "body" as const].every((key) => !entry[key]);
}

/** Mots écrits dans une page (questions et texte libre). */
export function countWords(entry: JournalText) {
  return [...JOURNAL_PROMPTS, "body" as const].reduce(
    (total, key) =>
      total + (entry[key]?.split(/\s+/u).filter(Boolean).length ?? 0),
    0,
  );
}

/** La page de `day` se modifie encore : ni dans le futur, ni trop ancienne. */
export function isEditableDay(day: string, today: string) {
  const age = daysBetween(day, today);
  return age >= 0 && age <= JOURNAL_EDITABLE_PAST_DAYS;
}

/**
 * Série en cours : jours écrits d'affilée jusqu'à aujourd'hui. La page du jour
 * pas encore écrite ne casse pas la série (elle part alors d'hier).
 */
export function journalStreak(days: Iterable<string>, today: string) {
  const written = new Set(days);
  let day = written.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (written.has(day)) {
    streak += 1;
    day = addDays(day, -1);
  }
  return streak;
}

/** Semaine (lundi à dimanche) ou mois qui contient `anchor`, bornes incluses. */
export function periodRange(period: JournalPeriod, anchor: string) {
  if (period === "week") {
    const from = addDays(anchor, 1 - isoWeekday(anchor));
    return { from, to: addDays(from, 6) };
  }
  const from = `${anchor.slice(0, 7)}-01`;
  const [year, month] = from.split("-").map(Number) as [number, number];
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { from, to: `${anchor.slice(0, 7)}-${String(last).padStart(2, "0")}` };
}

/** Premier jour de la période précédente (-1) ou suivante (+1). */
export function shiftPeriod(
  period: JournalPeriod,
  anchor: string,
  delta: -1 | 1,
) {
  const { from, to } = periodRange(period, anchor);
  return delta < 0
    ? periodRange(period, addDays(from, -1)).from
    : addDays(to, 1);
}

/** Moyenne arrondie au dixième, ou null sans valeur. */
export function average(values: readonly number[]) {
  if (values.length === 0) return null;
  const sum = values.reduce((total, value) => total + value, 0);
  return Math.round((sum / values.length) * 10) / 10;
}

export type JournalRecapStats = {
  /** Pages écrites dans la période. */
  written: number;
  /** Jours de la période déjà commencés (jusqu'à aujourd'hui). */
  elapsed: number;
  words: number;
  /** Moyennes des check-ins de la période, sur 5. */
  mood: number | null;
  energy: number | null;
};

/** Chiffres du récap d'une période, à partir de ses pages et check-ins. */
export function recapStats(input: {
  from: string;
  to: string;
  today: string;
  entries: readonly { day: string; words: number }[];
  checkIns: readonly { mood: number; energy: number }[];
}): JournalRecapStats {
  const end = input.to < input.today ? input.to : input.today;
  return {
    written: input.entries.length,
    elapsed: Math.max(0, daysBetween(input.from, end) + 1),
    words: input.entries.reduce((total, entry) => total + entry.words, 0),
    mood: average(input.checkIns.map((checkIn) => checkIn.mood)),
    energy: average(input.checkIns.map((checkIn) => checkIn.energy)),
  };
}

/** Début d'une page pour la liste du récap : première réponse, sur une ligne. */
export function excerpt(entry: JournalText, max = 140) {
  const first = ["body" as const, ...JOURNAL_PROMPTS]
    .map((key) => entry[key])
    .find(Boolean);
  const line = (first ?? "").replace(/\s+/gu, " ").trim();
  return line.length > max ? `${line.slice(0, max - 1).trimEnd()}…` : line;
}
