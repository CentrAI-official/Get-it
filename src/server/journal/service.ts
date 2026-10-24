import "server-only";
import {
  countWords,
  excerpt,
  isEditableDay,
  isEmptyEntry,
  journalStreak,
  periodRange,
  recapStats,
  shiftPeriod,
  type JournalEntryInput,
  type JournalPeriod,
  type JournalRecapStats,
  type JournalText,
} from "@/features/journal/rules";
import type { CheckInScores } from "@/features/today/schemas";
import { XP_REWARDS } from "@/features/xp/rules";
import { addDays, fromDbDate, toCalendarDay, toDbDate } from "@/lib/dates";
import { getCheckIn, listCheckIns } from "@/server/check-ins/service";
import { db } from "@/server/db";
import { awardJournal } from "@/server/xp/service";

// Chaque fonction reçoit l'userId de la session et filtre dessus. Le journal
// est privé : jamais montré à quelqu'un d'autre ni envoyé à Get iT AI.

const textSelect = {
  gratitude: true,
  win: true,
  lesson: true,
  intention: true,
  body: true,
} as const;

/** Jours écrits lus pour la série (au-delà, la série est plafonnée). */
const STREAK_LOOKBACK = 400;

export type JournalPage = {
  today: string;
  day: string;
  entry: JournalText | null;
  editable: boolean;
  /** Série en cours, jusqu'à aujourd'hui. */
  streak: number;
  /** Check-in de ce jour-là (celui d'aujourd'hui se fait en haut du journal). */
  checkIn: CheckInScores | null;
};

/** Série en cours de pages écrites jusqu'à `today`. */
async function getStreak(userId: string, today: string) {
  const rows = await db.journalEntry.findMany({
    where: { userId, day: { lte: toDbDate(today) } },
    orderBy: { day: "desc" },
    take: STREAK_LOOKBACK,
    select: { day: true },
  });
  return journalStreak(
    rows.map((row) => fromDbDate(row.day)),
    today,
  );
}

/**
 * Page d'un jour (aujourd'hui par défaut, dans le fuseau de l'utilisateur).
 * Un jour invalide ou à venir ramène à aujourd'hui.
 */
export async function getJournalPage(
  userId: string,
  timeZone: string,
  requested?: string,
): Promise<JournalPage> {
  const today = toCalendarDay(new Date(), timeZone);
  const day = requested && requested <= today ? requested : today;
  const [entry, streak, checkIn] = await Promise.all([
    db.journalEntry.findUnique({
      where: { userId_day: { userId, day: toDbDate(day) } },
      select: textSelect,
    }),
    getStreak(userId, today),
    getCheckIn(userId, day),
  ]);
  return {
    today,
    day,
    entry,
    editable: isEditableDay(day, today),
    streak,
    checkIn,
  };
}

export type SaveJournalResult =
  { ok: true; saved: boolean; xp: number } | { ok: false; error: "locked" };

/**
 * Enregistre la page d'un jour encore modifiable. La première version d'une
 * page rapporte de l'XP ; une page vidée est supprimée, avec son XP.
 */
export async function saveJournalEntry(
  userId: string,
  timeZone: string,
  input: JournalEntryInput,
): Promise<SaveJournalResult> {
  const today = toCalendarDay(new Date(), timeZone);
  if (!isEditableDay(input.day, today)) return { ok: false, error: "locked" };
  const day = toDbDate(input.day);
  const text: JournalText = {
    gratitude: input.gratitude,
    win: input.win,
    lesson: input.lesson,
    intention: input.intention,
    body: input.body,
  };

  if (isEmptyEntry(text)) {
    // La cascade retire aussi l'XP de la page
    await db.journalEntry.deleteMany({ where: { userId, day } });
    return { ok: true, saved: false, xp: 0 };
  }

  const data = { ...text, words: countWords(text) };
  const xp = await db.$transaction(async (tx) => {
    const entry = await tx.journalEntry.upsert({
      where: { userId_day: { userId, day } },
      update: data,
      create: { userId, day, ...data },
      select: { id: true, xpEvent: { select: { id: true } } },
    });
    if (entry.xpEvent) return 0;
    await awardJournal(tx, entry.id, {
      userId,
      amount: XP_REWARDS.journal,
      pillar: null,
      day: input.day,
    });
    return XP_REWARDS.journal;
  });
  return { ok: true, saved: true, xp };
}

export type JournalRecapEntry = {
  day: string;
  excerpt: string;
  words: number;
};

export type JournalRecap = {
  period: JournalPeriod;
  today: string;
  from: string;
  to: string;
  /** Premier jour des périodes voisines ; pas de suivante après aujourd'hui. */
  previous: string;
  next: string | null;
  stats: JournalRecapStats;
  streak: number;
  /** Pages de la période, de la plus récente à la plus ancienne. */
  entries: JournalRecapEntry[];
};

/** Récap d'une semaine ou d'un mois (celui d'aujourd'hui par défaut), sans IA. */
export async function getJournalRecap(
  userId: string,
  timeZone: string,
  period: JournalPeriod,
  anchor?: string,
): Promise<JournalRecap> {
  const today = toCalendarDay(new Date(), timeZone);
  const { from, to } = periodRange(
    period,
    anchor && anchor <= today ? anchor : today,
  );
  const [rows, checkIns, streak] = await Promise.all([
    db.journalEntry.findMany({
      where: { userId, day: { gte: toDbDate(from), lte: toDbDate(to) } },
      orderBy: { day: "desc" },
      select: { day: true, words: true, ...textSelect },
    }),
    listCheckIns(userId, from, to),
    getStreak(userId, today),
  ]);
  const entries = rows.map((row) => ({
    day: fromDbDate(row.day),
    words: row.words,
    excerpt: excerpt(row),
  }));
  const next = addDays(to, 1);
  return {
    period,
    today,
    from,
    to,
    previous: shiftPeriod(period, from, -1),
    next: next <= today ? next : null,
    stats: recapStats({ from, to, today, entries, checkIns }),
    streak,
    entries,
  };
}
