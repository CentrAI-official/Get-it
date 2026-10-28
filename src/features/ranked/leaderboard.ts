import { z } from "zod";

// Classement du mode Ranked : toutes les personnes classées (membres du Centre),
// ou seulement mes contacts, par niveau total, physique ou financier.

export const LEADERBOARD_PILLARS = ["total", "physical", "financial"] as const;
export type LeaderboardPillar = (typeof LEADERBOARD_PILLARS)[number];
export const LEADERBOARD_SCOPES = ["all", "contacts"] as const;
export type LeaderboardScope = (typeof LEADERBOARD_SCOPES)[number];
/** Personnes affichées au plus (ma place est toujours montrée). */
export const LEADERBOARD_SIZE = 100;

/** Filtres lus dans l'adresse (valeurs inconnues : les valeurs par défaut). */
export const leaderboardFiltersSchema = z.object({
  pillar: z.enum(LEADERBOARD_PILLARS).catch("total"),
  scope: z.enum(LEADERBOARD_SCOPES).catch("all"),
});

export type LeaderboardEntry = {
  id: string;
  level: number;
  /** Évaluation : à niveau égal, la plus ancienne passe devant. */
  evaluatedAt: string;
};

/**
 * Classement par niveau décroissant ; un même niveau partage le même rang
 * (1, 2, 2, 4…). À égalité, la personne évaluée la première est montrée avant.
 */
export function rankEntries<T extends LeaderboardEntry>(
  entries: readonly T[],
): (T & { rank: number })[] {
  const sorted = [...entries].sort(
    (a, b) =>
      b.level - a.level ||
      a.evaluatedAt.localeCompare(b.evaluatedAt) ||
      a.id.localeCompare(b.id),
  );
  let rank = 0;
  return sorted.map((entry, index) => {
    if (index === 0 || entry.level !== sorted[index - 1]?.level) {
      rank = index + 1;
    }
    return { ...entry, rank };
  });
}
