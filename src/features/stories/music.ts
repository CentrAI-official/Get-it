import { z } from "zod";
import { PILLARS, type Pillar } from "@/config/pillars";

// Musique des stories : catalogue Get iT de morceaux libres de droits (licence
// qui permet l'usage dans l'app), ajouté par l'équipe. Limites alignées sur la
// contrainte « music_tracks_check » de la migration (un test le vérifie).

/** Durée de l'extrait joué avec une story ; une photo avec musique dure autant. */
export const MUSIC_CLIP_MS = 15_000;
export const MUSIC_TITLE_MAX = 100;
export const MUSIC_ARTIST_MAX = 100;
export const MUSIC_LICENSE_MAX = 300;
export const MUSIC_MOODS_MAX = 8;
export const MUSIC_MOOD_MAX = 30;
export const MUSIC_MIN_MS = 5_000;
export const MUSIC_MAX_MS = 600_000;
export const MUSIC_MAX_BYTES = 20 * 1024 * 1024;
/** Morceaux montrés par onglet. */
export const MUSIC_LIST_SIZE = 30;
/** « Tendances » : les morceaux les plus utilisés ces 7 derniers jours. */
export const MUSIC_TRENDING_MS = 7 * 24 * 60 * 60 * 1000;

/** Types de fichiers acceptés, et leur extension dans le stockage. */
export const MUSIC_TYPES = {
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/aac": "aac",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
} as const;
export type MusicType = keyof typeof MUSIC_TYPES;

export const MUSIC_TABS = ["trending", "forYou", "search"] as const;
export type MusicTab = (typeof MUSIC_TABS)[number];

/** Musique choisie pour une story : le morceau et le début de l'extrait. */
export const storyMusicSchema = z
  .object({
    trackId: z.uuid(),
    startMs: z.int().min(0).max(MUSIC_MAX_MS),
  })
  .nullable();
export type StoryMusicInput = z.infer<typeof storyMusicSchema>;

/** Début d'extrait valide : ramené entre 0 et la durée moins 15 s. */
export function clampClipStart(startMs: number, durationMs: number) {
  return Math.max(0, Math.min(startMs, durationMs - MUSIC_CLIP_MS));
}

/** « Lo-fi, Motivation, lo-fi » → ["lo-fi", "motivation"] (8 au plus). */
export function parseMoods(value: string) {
  return [
    ...new Set(
      value
        .split(",")
        .map((mood) => mood.trim().toLowerCase())
        .filter((mood) => mood.length > 0 && mood.length <= MUSIC_MOOD_MAX),
    ),
  ].slice(0, MUSIC_MOODS_MAX);
}

/** Ajout d'un morceau au catalogue (équipe Get iT), après l'envoi du fichier. */
export const musicTrackFormSchema = z.object({
  title: z.string().trim().min(1).max(MUSIC_TITLE_MAX),
  artist: z.string().trim().min(1).max(MUSIC_ARTIST_MAX),
  moods: z.string().max(400).transform(parseMoods),
  pillars: z.array(z.enum(PILLARS)).max(PILLARS.length),
  license: z.string().trim().min(1).max(MUSIC_LICENSE_MAX),
  upload: z.object({
    path: z.string().regex(/^music\/[0-9a-f-]{36}\.(mp3|m4a|aac|wav)$/),
    durationMs: z.int().min(MUSIC_MIN_MS).max(MUSIC_MAX_MS),
  }),
});
export type MusicTrackInput = z.infer<typeof musicTrackFormSchema>;

/** Envoi d'un fichier audio : type et taille annoncés, revérifiés après l'envoi. */
export const musicUploadSchema = z.object({
  contentType: z.enum(Object.keys(MUSIC_TYPES) as [MusicType, ...MusicType[]]),
  sizeBytes: z.int().min(1).max(MUSIC_MAX_BYTES),
});

type ScoredTrack = {
  id: string;
  pillars: readonly Pillar[];
  createdAt: string;
};

/**
 * « Pour toi » : les morceaux des piliers prioritaires de la personne, ceux que
 * ses contacts utilisent et ceux qu'elle a déjà choisis, puis les plus récents.
 */
export function rankForYou<T extends ScoredTrack>(
  tracks: readonly T[],
  context: {
    pillars: readonly Pillar[];
    /** Utilisations par les contacts ces 7 derniers jours. */
    contactUses: ReadonlyMap<string, number>;
    /** Morceaux déjà choisis par la personne. */
    mine: ReadonlySet<string>;
  },
): T[] {
  const score = (track: T) =>
    track.pillars.filter((pillar) => context.pillars.includes(pillar)).length *
      3 +
    Math.min(5, context.contactUses.get(track.id) ?? 0) * 2 +
    (context.mine.has(track.id) ? 2 : 0);
  return [...tracks].sort(
    (a, b) => score(b) - score(a) || b.createdAt.localeCompare(a.createdAt),
  );
}

/** « Tendances » : les plus utilisés d'abord, puis les plus récents. */
export function rankTrending<T extends ScoredTrack>(
  tracks: readonly T[],
  uses: ReadonlyMap<string, number>,
): T[] {
  return [...tracks].sort(
    (a, b) =>
      (uses.get(b.id) ?? 0) - (uses.get(a.id) ?? 0) ||
      b.createdAt.localeCompare(a.createdAt),
  );
}
