import "server-only";
import type { CheckInScores } from "@/features/today/schemas";
import { XP_REWARDS } from "@/features/xp/rules";
import { fromDbDate, toDbDate } from "@/lib/dates";
import { db } from "@/server/db";
import { awardCheckIn } from "@/server/xp/service";

// Chaque fonction reçoit l'userId de la session et filtre dessus.

const scoresSelect = {
  mood: true,
  energy: true,
  stress: true,
  sleep: true,
} as const;

/** Check-in d'un jour (« AAAA-MM-JJ »), ou null s'il n'a pas encore été fait. */
export async function getCheckIn(
  userId: string,
  day: string,
): Promise<CheckInScores | null> {
  return db.dailyCheckIn.findUnique({
    where: { userId_day: { userId, day: toDbDate(day) } },
    select: scoresSelect,
  });
}

/** Check-ins faits entre `from` et `to` inclus, du plus ancien au plus récent. */
export async function listCheckIns(
  userId: string,
  from: string,
  to: string,
): Promise<(CheckInScores & { day: string })[]> {
  const rows = await db.dailyCheckIn.findMany({
    where: { userId, day: { gte: toDbDate(from), lte: toDbDate(to) } },
    orderBy: { day: "asc" },
    select: { day: true, ...scoresSelect },
  });
  return rows.map((row) => ({ ...row, day: fromDbDate(row.day) }));
}

/**
 * Enregistre le check-in du jour ; le refaire dans la journée le remplace.
 * Le premier du jour rapporte de l'XP, pas les modifications.
 */
export async function saveCheckIn(
  userId: string,
  day: string,
  scores: CheckInScores,
) {
  const data = {
    mood: scores.mood,
    energy: scores.energy,
    stress: scores.stress,
    sleep: scores.sleep,
  };
  await db.$transaction(async (tx) => {
    const checkIn = await tx.dailyCheckIn.upsert({
      where: { userId_day: { userId, day: toDbDate(day) } },
      update: data,
      create: { userId, day: toDbDate(day), ...data },
      select: { id: true },
    });
    await awardCheckIn(tx, checkIn.id, {
      userId,
      amount: XP_REWARDS.checkIn,
      pillar: null,
      day,
    });
  });
}
