import { z } from "zod";

// Photos et vidéos des publications (validées avec le fondateur) : 4 photos ou
// 1 vidéo de 60 secondes au plus. Les mêmes limites sont garanties en base
// (contraintes de la migration « post_media ») et par le compartiment de stockage.

export const MAX_PHOTOS = 4;
export const MAX_VIDEO_SECONDS = 60;
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
/** Photo après réduction (au-delà, le fichier d'origine est refusé). */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
/** Plus grand côté d'une photo après réduction, en pixels. */
export const IMAGE_MAX_DIMENSION = 2048;
/** Fichiers envoyés par 24 heures (anti-abus). */
export const DAILY_UPLOAD_LIMIT = 40;
/** Durée de validité d'un envoi non utilisé, et des liens de lecture. */
export const UPLOAD_TTL_MS = 24 * 60 * 60 * 1000;
export const SIGNED_URL_SECONDS = 60 * 60;

export const IMAGE_TYPES = ["image/webp", "image/jpeg", "image/png"] as const;
export const VIDEO_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
] as const;
export type MediaMimeType =
  (typeof IMAGE_TYPES)[number] | (typeof VIDEO_TYPES)[number];

export const EXTENSIONS: Record<MediaMimeType, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

export type MediaKind = "image" | "video";

export function kindOf(mimeType: string): MediaKind | null {
  if ((IMAGE_TYPES as readonly string[]).includes(mimeType)) return "image";
  if ((VIDEO_TYPES as readonly string[]).includes(mimeType)) return "video";
  return null;
}

/**
 * Une publication porte jusqu'à 4 photos, ou une seule vidéo (avec son image
 * d'aperçu) : jamais les deux.
 */
export function mediaSetError(
  items: readonly { kind: MediaKind }[],
): "mediaTooMany" | null {
  const videos = items.filter((item) => item.kind === "video").length;
  const images = items.length - videos;
  if (videos > 1) return "mediaTooMany";
  if (videos === 1 && images > 0) return "mediaTooMany";
  if (images > MAX_PHOTOS) return "mediaTooMany";
  return null;
}

/** Taille d'une photo réduite pour que son plus grand côté tienne dans `max`. */
export function fitDimensions(width: number, height: number, max: number) {
  const scale = Math.min(1, max / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** Demande d'envoi : un fichier déjà préparé par le navigateur. */
export const uploadRequestSchema = z
  .array(
    z.object({
      mimeType: z.enum([...IMAGE_TYPES, ...VIDEO_TYPES], {
        error: "mediaType",
      }),
      size: z.number().int().positive(),
      /** Image d'aperçu d'une vidéo (ne compte pas parmi les photos). */
      poster: z.boolean().optional().default(false),
    }),
  )
  .min(1)
  .max(MAX_PHOTOS + 1);

export type UploadRequest = z.infer<typeof uploadRequestSchema>;

/** Médias joints à une publication, envoyés au préalable. */
export const postMediaSchema = z
  .array(
    z.object({
      uploadId: z.uuid(),
      width: z.number().int().min(1).max(20000),
      height: z.number().int().min(1).max(20000),
      durationMs: z
        .number()
        .int()
        .min(1)
        .max(MAX_VIDEO_SECONDS * 1000 + 1000, { error: "videoTooLong" })
        .optional(),
      posterUploadId: z.uuid().optional(),
    }),
  )
  .max(MAX_PHOTOS, { error: "mediaTooMany" });

export type PostMediaInput = z.infer<typeof postMediaSchema>;
