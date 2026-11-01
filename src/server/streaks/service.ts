import "server-only";
import { PILLARS, type Pillar } from "@/config/pillars";
import { fromDbDate } from "@/lib/dates";
import { db } from "@/server/db";

// Jours actifs : un jour où la personne a fait au moins une action (habitude
// cochée, tâche, jalon ou objectif terminé, check-in, page de journal). Les
// moments (tâches, jalons, objectifs) sont ramenés au jour dans son fuseau.
// Chaque fonction reçoit l'userId de la session.

export type Activity = {
  /** Jours actifs, du plus ancien au plus récent. */
  days: string[];
  /** Jours actifs de chaque pilier (check-in et journal comptent pour le mental). */
  pillars: Record<Pillar, string[]>;
};

type ActivityRow = { day: Date; pillar: Pillar | null };

/** Tous les jours actifs de la personne, et ceux de chaque pilier. */
export async function getActivity(
  userId: string,
  timeZone: string,
): Promise<Activity> {
  const rows = await db.$queryRaw<ActivityRow[]>`
    SELECT DISTINCT day, pillar FROM (
      SELECT c.day, h.pillar::text AS pillar
        FROM habit_completions c JOIN habits h ON h.id = c.habit_id
        WHERE h.user_id = ${userId}::uuid
      UNION ALL
      SELECT (t.completed_at AT TIME ZONE ${timeZone})::date, g.pillar::text
        FROM tasks t LEFT JOIN goals g ON g.id = t.goal_id
        WHERE t.user_id = ${userId}::uuid AND t.completed_at IS NOT NULL
      UNION ALL
      SELECT (m.completed_at AT TIME ZONE ${timeZone})::date, g.pillar::text
        FROM goal_milestones m JOIN goals g ON g.id = m.goal_id
        WHERE g.user_id = ${userId}::uuid AND m.completed_at IS NOT NULL
      UNION ALL
      SELECT (completed_at AT TIME ZONE ${timeZone})::date, pillar::text
        FROM goals WHERE user_id = ${userId}::uuid AND completed_at IS NOT NULL
      UNION ALL
      SELECT day, 'mental' FROM daily_check_ins WHERE user_id = ${userId}::uuid
      UNION ALL
      SELECT day, 'mental' FROM journal_entries WHERE user_id = ${userId}::uuid
    ) activity
    ORDER BY day`;

  const days = new Set<string>();
  const pillars = Object.fromEntries(
    PILLARS.map((pillar) => [pillar, new Set<string>()]),
  ) as Record<Pillar, Set<string>>;
  for (const row of rows) {
    const day = fromDbDate(row.day);
    days.add(day);
    if (row.pillar) pillars[row.pillar].add(day);
  }
  return {
    days: [...days],
    pillars: Object.fromEntries(
      PILLARS.map((pillar) => [pillar, [...pillars[pillar]]]),
    ) as Record<Pillar, string[]>,
  };
}

/**
 * Jours où chaque objectif a avancé : un jalon, une tâche liée ou une habitude
 * liée faits ce jour-là (pour sa série de semaines, `weekStreak`).
 */
export async function getGoalActivity(
  userId: string,
  timeZone: string,
  goalIds: readonly string[],
): Promise<Map<string, string[]>> {
  const activity = new Map<string, string[]>(goalIds.map((id) => [id, []]));
  if (goalIds.length === 0) return activity;
  const ids = [...goalIds];
  const rows = await db.$queryRaw<{ goalId: string; day: Date }[]>`
    SELECT DISTINCT a.goal_id::text AS "goalId", a.day FROM (
      SELECT goal_id, (completed_at AT TIME ZONE ${timeZone})::date AS day
        FROM goal_milestones
        WHERE goal_id = ANY(${ids}::uuid[]) AND completed_at IS NOT NULL
      UNION ALL
      SELECT goal_id, (completed_at AT TIME ZONE ${timeZone})::date
        FROM tasks
        WHERE goal_id = ANY(${ids}::uuid[]) AND completed_at IS NOT NULL
      UNION ALL
      SELECT h.goal_id, c.day
        FROM habit_completions c JOIN habits h ON h.id = c.habit_id
        WHERE h.goal_id = ANY(${ids}::uuid[])
    ) a
    -- Seulement les objectifs de la personne
    JOIN goals g ON g.id = a.goal_id AND g.user_id = ${userId}::uuid
    ORDER BY a.day`;
  for (const row of rows) activity.get(row.goalId)?.push(fromDbDate(row.day));
  return activity;
}
