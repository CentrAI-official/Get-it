import "server-only";
import type { CheckInScores } from "@/features/today/schemas";
import { toDbDate } from "@/lib/dates";
import { db } from "@/server/db";

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

/** Enregistre le check-in du jour ; le refaire dans la journée le remplace. */
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
  await db.dailyCheckIn.upsert({
    where: { userId_day: { userId, day: toDbDate(day) } },
    update: data,
    create: { userId, day: toDbDate(day), ...data },
  });
}
