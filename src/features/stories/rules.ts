import { z } from "zod";
import { postMediaSchema } from "@/features/community/media";
import { MUSIC_CLIP_MS, storyMusicSchema } from "./music";
import { storyOverlaysSchema } from "./studio";

// Stories du Centre : une photo ou une vidéo, visible 24 heures par les contacts
// de son auteur. Limites alignées sur la contrainte « stories_check » de la migration.

export const STORY_TTL_MS = 24 * 60 * 60 * 1000;
export const STORY_CAPTION_MAX = 200;
/** Stories publiées par 24 heures (anti-abus). */
export const DAILY_STORY_LIMIT = 20;
/** Durée d'affichage d'une photo dans la visionneuse (avec musique : l'extrait). */
export const STORY_IMAGE_MS = 5000;
/** Une story signalée reste lisible par la modération 7 jours après sa fin. */
export const REPORTED_STORY_GRACE_MS = 7 * 24 * 60 * 60 * 1000;
/** Réactions rapides sous une story : envoyées à l'auteur en message. */
export const STORY_REACTIONS = ["❤️", "😂", "😮", "😢", "👏", "🔥"] as const;

/** Durée d'une photo : 5 s, ou l'extrait de 15 s quand elle a une musique. */
export const imageDuration = (hasMusic: boolean) =>
  hasMusic ? MUSIC_CLIP_MS : STORY_IMAGE_MS;

/**
 * Une story : exactement un média (photo, ou vidéo avec son aperçu), une
 * légende (anciennes stories), les textes et stickers, et la musique.
 */
export const storyInputSchema = z
  .object({
    media: postMediaSchema.length(1, { error: "mediaMissing" }),
    caption: z
      .string()
      .trim()
      .max(STORY_CAPTION_MAX, { error: "storyCaptionTooLong" })
      .default(""),
    overlays: storyOverlaysSchema.default([]),
    music: storyMusicSchema.default(null),
  })
  .superRefine((input, context) => {
    // L'étiquette de musique ne va qu'avec une musique
    if (
      input.music === null &&
      input.overlays.some((item) => item.kind === "music")
    ) {
      context.addIssue({ code: "custom", message: "storyOverlays" });
    }
  });
export type StoryInput = z.infer<typeof storyInputSchema>;

/** Fin d'une story publiée à `createdAt`. */
export const storyExpiry = (createdAt: Date) =>
  new Date(createdAt.getTime() + STORY_TTL_MS);

type Ring = { latestAt: string; stories: readonly { id: string }[] };

/** Vrai si la personne a au moins une story pas encore vue sur cet appareil. */
export const hasUnseen = (ring: Ring, seen: ReadonlySet<string>) =>
  ring.stories.some((story) => !seen.has(story.id));

/**
 * Ordre des anneaux de mes contacts : ceux qui ont du nouveau d'abord, puis les
 * autres ; dans chaque groupe, la story la plus récente en premier.
 */
export function orderRings<T extends Ring>(
  rings: readonly T[],
  seen: ReadonlySet<string>,
): T[] {
  return [...rings].sort((a, b) => {
    const unseen = Number(hasUnseen(b, seen)) - Number(hasUnseen(a, seen));
    return unseen !== 0 ? unseen : b.latestAt.localeCompare(a.latestAt);
  });
}

/** Première story pas encore vue d'une personne (sinon la première). */
export function firstUnseenIndex(ring: Ring, seen: ReadonlySet<string>) {
  const index = ring.stories.findIndex((story) => !seen.has(story.id));
  return index === -1 ? 0 : index;
}
