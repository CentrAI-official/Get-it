import "server-only";
import type { Pillar } from "@/config/pillars";
import { EDITABLE_DAYS } from "@/features/habits/schemas";
import { habitDayXp } from "@/features/xp/rules";
import { addDays, fromDbDate, toCalendarDay, toDbDate } from "@/lib/dates";
import { db } from "@/server/db";
import { awardHabitDay } from "@/server/xp/service";

// Chaque fonction reçoit l'userId de la session et filtre dessus : un utilisateur
// ne lit et ne modifie que ses propres habitudes.

export type HabitSummary = {
  id: string;
  title: string;
  pillar: Pillar;
  /** Jours prévus, de 1 (lundi) à 7 (dimanche). */
  weekdays: number[];
  goal: { id: string; title: string } | null;
  archived: boolean;
  /** Premier jour suivi (création), dans le fuseau de l'utilisateur. */
  startDay: string;
  /** Jours faits, « AAAA-MM-JJ », du plus ancien au plus récent. */
  completions: string[];
};

/** Toutes les habitudes, avec leurs jours faits (pour calculer les séries). */
export async function listHabits(
  userId: string,
  timeZone: string,
): Promise<HabitSummary[]> {
  const habits = await db.habit.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      title: true,
      pillar: true,
      weekdays: true,
      archivedAt: true,
      createdAt: true,
      goal: { select: { id: true, title: true } },
      completions: { orderBy: { day: "asc" }, select: { day: true } },
    },
  });

  return habits.map((habit) => ({
    id: habit.id,
    title: habit.title,
    pillar: habit.pillar,
    weekdays: habit.weekdays,
    goal: habit.goal,
    archived: habit.archivedAt !== null,
    startDay: toCalendarDay(habit.createdAt, timeZone),
    completions: habit.completions.map((completion) =>
      fromDbDate(completion.day),
    ),
  }));
}

/** Une habitude à modifier, ou null si elle n'existe pas pour cet utilisateur. */
export async function getHabit(userId: string, habitId: string) {
  const habit = await db.habit.findFirst({
    where: { id: habitId, userId },
    select: {
      id: true,
      title: true,
      pillar: true,
      weekdays: true,
      goal: { select: { id: true, title: true } },
      archivedAt: true,
    },
  });
  return habit ? { ...habit, archived: habit.archivedAt !== null } : null;
}

type HabitFields = {
  title: string;
  pillar: Pillar;
  weekdays: number[];
  goalId: string | null;
};

/** Seulement les colonnes de l'habitude (l'entrée validée contient aussi la langue). */
function toHabitData(input: HabitFields) {
  return {
    title: input.title,
    pillar: input.pillar,
    weekdays: input.weekdays,
    goalId: input.goalId,
  };
}

/** Vrai si l'objectif lié (facultatif) appartient bien à l'utilisateur. */
async function canLinkGoal(userId: string, goalId: string | null) {
  if (!goalId) return true;
  const goal = await db.goal.findFirst({
    where: { id: goalId, userId },
    select: { id: true },
  });
  return goal !== null;
}

/** Crée une habitude et renvoie son id, ou null si l'objectif lié est introuvable. */
export async function createHabit(userId: string, input: HabitFields) {
  if (!(await canLinkGoal(userId, input.goalId))) return null;
  const habit = await db.habit.create({
    data: { userId, ...toHabitData(input) },
    select: { id: true },
  });
  return habit.id;
}

/** Modifie une habitude. Faux si elle (ou l'objectif lié) n'existe pas pour cet utilisateur. */
export async function updateHabit(
  userId: string,
  habitId: string,
  input: HabitFields,
) {
  if (!(await canLinkGoal(userId, input.goalId))) return false;
  return db.$transaction(async (tx) => {
    const { count } = await tx.habit.updateMany({
      where: { id: habitId, userId },
      data: toHabitData(input),
    });
    if (count === 0) return false;
    // L'XP déjà gagnée suit le pilier de l'habitude
    await tx.xpEvent.updateMany({
      where: { userId, habitCompletion: { habitId } },
      data: { pillar: input.pillar },
    });
    return true;
  });
}

/** Met en pause (archive) ou reprend une habitude. */
export async function setHabitArchived(
  userId: string,
  habitId: string,
  archived: boolean,
) {
  const { count } = await db.habit.updateMany({
    where: { id: habitId, userId },
    data: { archivedAt: archived ? new Date() : null },
  });
  return count > 0;
}

/** Supprime une habitude et son historique (cascade). */
export async function deleteHabit(userId: string, habitId: string) {
  const { count } = await db.habit.deleteMany({
    where: { id: habitId, userId },
  });
  return count > 0;
}

/**
 * Coche ou décoche un jour. Seuls aujourd'hui et les jours précédents rattrapables
 * sont acceptés, jamais avant la création de l'habitude. Faux sinon, ou si
 * l'habitude n'existe pas (ou est en pause) pour cet utilisateur.
 */
export async function setHabitDay(
  userId: string,
  input: { habitId: string; day: string; done: boolean; timeZone: string },
) {
  const habit = await db.habit.findFirst({
    where: { id: input.habitId, userId, archivedAt: null },
    select: { createdAt: true, pillar: true, weekdays: true },
  });
  if (!habit) return false;

  const today = toCalendarDay(new Date(), input.timeZone);
  const firstEditable = addDays(today, 1 - EDITABLE_DAYS);
  const startDay = toCalendarDay(habit.createdAt, input.timeZone);
  if (input.day > today || input.day < firstEditable || input.day < startDay) {
    return false;
  }

  const day = toDbDate(input.day);
  if (input.done) {
    await db.$transaction(async (tx) => {
      const completion = await tx.habitCompletion.upsert({
        where: { habitId_day: { habitId: input.habitId, day } },
        update: {},
        create: { habitId: input.habitId, day },
        select: { id: true },
      });
      await awardHabitDay(tx, completion.id, {
        userId,
        amount: habitDayXp(habit.weekdays, input.day),
        pillar: habit.pillar,
        day: input.day,
      });
    });
  } else {
    // L'XP du jour part avec lui (cascade)
    await db.habitCompletion.deleteMany({
      where: { habitId: input.habitId, day },
    });
  }
  return true;
}
