import "server-only";
import { randomUUID } from "node:crypto";
import type { Pillar } from "@/config/pillars";
import {
  MUSIC_LIST_SIZE,
  MUSIC_MAX_BYTES,
  MUSIC_TRENDING_MS,
  MUSIC_TYPES,
  rankForYou,
  rankTrending,
  type MusicTab,
  type MusicTrackInput,
  type MusicType,
} from "@/features/stories/music";
import { contactIds } from "@/server/contacts/service";
import { db } from "@/server/db";
import {
  createUploadUrl,
  fileInfo,
  signedUrls,
} from "@/server/storage/service";

// Catalogue de musique des stories : morceaux libres de droits ajoutés par
// l'équipe Get iT (rôle admin). Fichiers dans le compartiment privé, lus par
// des liens temporaires. « Tendances » et « Pour toi » viennent de l'usage
// dans Get iT (jamais d'un service de streaming).

export type MusicTrackItem = {
  id: string;
  title: string;
  artist: string;
  moods: string[];
  durationMs: number;
  /** Lien de lecture temporaire (une heure). */
  url: string;
};

const trackSelect = {
  id: true,
  title: true,
  artist: true,
  moods: true,
  pillars: true,
  path: true,
  durationMs: true,
  createdAt: true,
} as const;

async function isAdmin(userId: string) {
  const profile = await db.profile.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  return profile?.role === "admin";
}

/** Utilisations de chaque morceau dans des stories récentes (de ces personnes). */
async function usesSince(since: Date, authors?: string[]) {
  const rows = await db.story.groupBy({
    by: ["musicTrackId"],
    where: {
      musicTrackId: { not: null },
      createdAt: { gte: since },
      ...(authors ? { userId: { in: authors } } : {}),
    },
    _count: { _all: true },
  });
  return new Map(
    rows.flatMap((row) =>
      row.musicTrackId ? [[row.musicTrackId, row._count._all] as const] : [],
    ),
  );
}

/** Morceaux d'un onglet : Tendances, Pour toi, ou une recherche. */
export async function listMusic(
  userId: string,
  tab: MusicTab,
  query: string,
): Promise<MusicTrackItem[]> {
  const search = query.trim();
  const rows = await db.musicTrack.findMany({
    where: {
      active: true,
      ...(tab === "search" && search
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" } },
              { artist: { contains: search, mode: "insensitive" } },
              { moods: { has: search.toLowerCase() } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 300,
    select: trackSelect,
  });
  const tracks = rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
  }));
  const since = new Date(Date.now() - MUSIC_TRENDING_MS);

  let ranked = tracks;
  if (tab === "trending") {
    ranked = rankTrending(tracks, await usesSince(since));
  } else if (tab === "forYou") {
    const [profile, contacts, mine] = await Promise.all([
      db.profile.findUnique({
        where: { id: userId },
        select: { focusPillars: true },
      }),
      contactIds(userId),
      db.story.findMany({
        where: { userId, musicTrackId: { not: null } },
        select: { musicTrackId: true },
        distinct: ["musicTrackId"],
        take: 50,
      }),
    ]);
    ranked = rankForYou(tracks, {
      pillars: (profile?.focusPillars ?? []) as Pillar[],
      contactUses: await usesSince(since, [...contacts]),
      mine: new Set(mine.flatMap((row) => row.musicTrackId ?? [])),
    });
  }
  const shown = ranked.slice(0, MUSIC_LIST_SIZE);
  const urls = await signedUrls(shown.map((track) => track.path));
  return shown.flatMap((track) => {
    const url = urls.get(track.path);
    return url
      ? [
          {
            id: track.id,
            title: track.title,
            artist: track.artist,
            moods: track.moods,
            durationMs: track.durationMs,
            url,
          },
        ]
      : [];
  });
}

/** Un morceau encore au catalogue (pour une story) ; null sinon. */
export async function activeTrack(trackId: string) {
  return db.musicTrack.findFirst({
    where: { id: trackId, active: true },
    select: { id: true, durationMs: true },
  });
}

/** Autorisation d'envoi d'un fichier audio (équipe Get iT seulement). */
export async function requestMusicUpload(
  userId: string,
  contentType: MusicType,
) {
  if (!(await isAdmin(userId))) return null;
  const path = `music/${randomUUID()}.${MUSIC_TYPES[contentType]}`;
  return { path, url: await createUploadUrl(path) };
}

/**
 * Ajoute un morceau au catalogue, après avoir revérifié le fichier envoyé
 * (présent, audio, pas trop lourd). Faux si ce n'est pas un admin ou si le
 * fichier ne convient pas.
 */
export async function createMusicTrack(userId: string, input: MusicTrackInput) {
  if (!(await isAdmin(userId)))
    return { ok: false as const, error: "forbidden" };
  const info = await fileInfo(input.upload.path);
  if (
    !info ||
    info.size <= 0 ||
    info.size > MUSIC_MAX_BYTES ||
    !(info.mimeType in MUSIC_TYPES)
  ) {
    return { ok: false as const, error: "fileInvalid" };
  }
  await db.musicTrack.create({
    data: {
      title: input.title,
      artist: input.artist,
      moods: input.moods,
      pillars: input.pillars,
      license: input.license,
      path: input.upload.path,
      durationMs: input.upload.durationMs,
      sizeBytes: info.size,
      addedById: userId,
    },
  });
  return { ok: true as const };
}

/** Le catalogue entier, pour l'équipe : utilisations et état. */
export async function listCatalog(userId: string) {
  if (!(await isAdmin(userId))) return null;
  const [tracks, uses] = await Promise.all([
    db.musicTrack.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        artist: true,
        moods: true,
        license: true,
        active: true,
        durationMs: true,
        createdAt: true,
      },
    }),
    usesSince(new Date(0)),
  ]);
  return tracks.map((track) => ({
    ...track,
    createdAt: track.createdAt.toISOString(),
    uses: uses.get(track.id) ?? 0,
  }));
}

/** Retire un morceau du catalogue (ou le remet). */
export async function setTrackActive(
  userId: string,
  trackId: string,
  active: boolean,
) {
  if (!(await isAdmin(userId))) return false;
  const { count } = await db.musicTrack.updateMany({
    where: { id: trackId },
    data: { active },
  });
  return count > 0;
}
