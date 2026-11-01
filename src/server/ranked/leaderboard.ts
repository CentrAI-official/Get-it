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
import { levelsOf } from "@/server/levels/service";
import { avatarUrls } from "@/server/profile/avatar";

// Classement Ranked : les niveaux des personnes en Ranked sont publics, mais
// seules les personnes membres du Centre (nom d'utilisateur) y figurent, sans
// les personnes bloquées dans un sens ou dans l'autre. À niveau égal, la
// première passée en Ranked est montrée avant.

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
  // Personnes en Ranked et membres du Centre ; leurs niveaux viennent de leurs mesures
  const members = await db.profile.findMany({
    where: {
      ...(allowed ? { id: { in: allowed } } : {}),
      rankedAt: { not: null },
      username: { not: null },
      settings: { communityRulesAt: { not: null } },
    },
    select: { id: true, displayName: true, username: true, avatarPath: true },
  });
  const visible = members.filter((member) => !blocked.includes(member.id));
  const levels = await levelsOf(
    visible.map((member) => member.id),
    { rankedOnly: true },
  );
  const ranked = rankEntries(
    visible.flatMap((member) => {
      const level = levels.get(member.id);
      const value = level?.[pillar] ?? null;
      // Un pilier pas encore mesuré n'est pas classé
      return level && value !== null
        ? [
            {
              id: member.id,
              level: value,
              evaluatedAt: (level.rankedAt ?? new Date(0)).toISOString(),
              row: { profile: member },
            },
          ]
        : [];
    }),
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
