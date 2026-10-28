import "server-only";
import {
  LEADERBOARD_SIZE,
  rankEntries,
  type LeaderboardPillar,
  type LeaderboardScope,
} from "@/features/ranked/leaderboard";
import { getBlockedIds } from "@/server/community/members";
import { contactIds } from "@/server/contacts/service";
import { db } from "@/server/db";
import { avatarUrls } from "@/server/profile/avatar";

// Classement Ranked : les niveaux classés sont publics (case d'accord), mais
// seules les personnes membres du Centre (nom d'utilisateur) y figurent, sans
// les personnes bloquées dans un sens ou dans l'autre.

export type LeaderboardRow = {
  rank: number;
  level: number;
  mine: boolean;
  person: {
    id: string;
    displayName: string | null;
    username: string;
    avatarUrl: string | null;
  };
};

export async function getLeaderboard(
  viewerId: string,
  pillar: LeaderboardPillar,
  scope: LeaderboardScope,
): Promise<{
  rows: LeaderboardRow[];
  mine: LeaderboardRow | null;
  count: number;
}> {
  const [blocked, contacts] = await Promise.all([
    getBlockedIds(viewerId),
    scope === "contacts" ? contactIds(viewerId) : null,
  ]);
  const allowed = contacts ? [viewerId, ...contacts] : null;
  // La plus récente évaluation de chaque personne fait foi
  const latest = await db.rankedEvaluation.findMany({
    where: {
      ...(allowed ? { userId: { in: allowed } } : {}),
      profile: {
        username: { not: null },
        settings: { communityRulesAt: { not: null } },
      },
    },
    distinct: ["userId"],
    orderBy: [{ userId: "asc" }, { createdAt: "desc" }],
    select: {
      userId: true,
      total: true,
      physical: true,
      financial: true,
      createdAt: true,
      profile: {
        select: { displayName: true, username: true, avatarPath: true },
      },
    },
  });
  const visible = latest.filter((row) => !blocked.includes(row.userId));
  const ranked = rankEntries(
    visible.map((row) => ({
      id: row.userId,
      level: row[pillar],
      evaluatedAt: row.createdAt.toISOString(),
      row,
    })),
  );
  const mineIndex = ranked.findIndex((entry) => entry.id === viewerId);
  const shown = ranked.slice(0, LEADERBOARD_SIZE);
  const mineEntry = mineIndex >= 0 ? ranked[mineIndex] : undefined;
  const avatars = await avatarUrls(
    [...shown, ...(mineEntry ? [mineEntry] : [])].map(
      (entry) => entry.row.profile.avatarPath,
    ),
  );
  const toRow = (entry: (typeof ranked)[number]): LeaderboardRow => ({
    rank: entry.rank,
    level: entry.level,
    mine: entry.id === viewerId,
    person: {
      id: entry.id,
      displayName: entry.row.profile.displayName,
      username: entry.row.profile.username ?? "",
      avatarUrl: entry.row.profile.avatarPath
        ? (avatars.get(entry.row.profile.avatarPath) ?? null)
        : null,
    },
  });
  return {
    rows: shown.map(toRow),
    mine: mineEntry ? toRow(mineEntry) : null,
    count: ranked.length,
  };
}
