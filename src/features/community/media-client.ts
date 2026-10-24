import {
  fitDimensions,
  IMAGE_MAX_DIMENSION,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  MAX_VIDEO_SECONDS,
  VIDEO_TYPES,
} from "./media";

// Préparation des fichiers dans le navigateur, avant l'envoi : les photos sont
// réduites et réencodées (ce qui retire leur position GPS et leurs autres
// métadonnées), les vidéos sont mesurées (durée, taille) et reçoivent une image
// d'aperçu.

export type PreparedImage = { blob: Blob; width: number; height: number };
export type PreparedVideo = {
  file: Blob;
  mimeType: string;
  width: number;
  height: number;
  durationMs: number;
  poster: PreparedImage | null;
};

export class MediaError extends Error {
  constructor(readonly code: "mediaType" | "mediaTooLarge" | "videoTooLong") {
    super(code);
  }
}

function encode(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (webp) => {
        if (webp?.type === "image/webp") return resolve(webp);
        // Navigateur sans WebP : JPEG
        canvas.toBlob(
          (jpeg) =>
            jpeg ? resolve(jpeg) : reject(new MediaError("mediaType")),
          "image/jpeg",
          0.85,
        );
      },
      "image/webp",
      0.85,
    );
  });
}

function draw(
  source: CanvasImageSource,
  width: number,
  height: number,
  max: number,
) {
  const size = fitDimensions(width, height, max);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d");
  if (!context) throw new MediaError("mediaType");
  context.drawImage(source, 0, 0, size.width, size.height);
  return { canvas, ...size };
}

/** Photo réduite (2048 px au plus) et réencodée, sans métadonnées. */
export async function prepareImage(file: Blob): Promise<PreparedImage> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new MediaError("mediaType");
  }
  const { canvas, width, height } = draw(
    bitmap,
    bitmap.width,
    bitmap.height,
    IMAGE_MAX_DIMENSION,
  );
  bitmap.close();
  const blob = await encode(canvas);
  if (blob.size > MAX_IMAGE_BYTES) throw new MediaError("mediaTooLarge");
  return { blob, width, height };
}

/** Vidéo mesurée (60 secondes et 50 Mo au plus), avec une image d'aperçu. */
export async function prepareVideo(file: File): Promise<PreparedVideo> {
  const mimeType = file.type || "video/mp4";
  if (!(VIDEO_TYPES as readonly string[]).includes(mimeType)) {
    throw new MediaError("mediaType");
  }
  if (file.size > MAX_VIDEO_BYTES) throw new MediaError("mediaTooLarge");
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.src = url;
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new MediaError("mediaType"));
    });
    const durationMs = Math.round(video.duration * 1000);
    if (!Number.isFinite(durationMs) || durationMs <= 0) {
      throw new MediaError("mediaType");
    }
    if (durationMs > MAX_VIDEO_SECONDS * 1000 + 500) {
      throw new MediaError("videoTooLong");
    }
    const width = video.videoWidth || 720;
    const height = video.videoHeight || 1280;
    // Image d'aperçu : une image prise au début de la vidéo (facultative)
    let poster: PreparedImage | null = null;
    try {
      video.currentTime = Math.min(0.5, video.duration / 2);
      await new Promise<void>((resolve, reject) => {
        video.onseeked = () => resolve();
        video.onerror = () => reject(new Error("aperçu"));
      });
      const frame = draw(video, width, height, 1280);
      poster = {
        blob: await encode(frame.canvas),
        width: frame.width,
        height: frame.height,
      };
    } catch {
      poster = null;
    }
    return { file, mimeType, width, height, durationMs, poster };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Envoie un fichier avec l'autorisation à usage unique ; `onProgress` de 0 à 1. */
export function uploadFile(
  url: string,
  blob: Blob,
  onProgress: (part: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const body = new FormData();
    body.append("cacheControl", "3600");
    body.append("", blob);
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    request.setRequestHeader("x-upsert", "false");
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    request.onload = () =>
      request.status >= 200 && request.status < 300
        ? resolve()
        : reject(new Error(`Envoi refusé (${request.status})`));
    request.onerror = () => reject(new Error("Envoi interrompu"));
    request.send(body);
  });
}

/** Côté d'une photo de profil, en pixels. */
const AVATAR_SIZE = 512;

/**
 * Photo de profil : le centre de l'image en carré, 512 px au plus, réencodée
 * (sans métadonnées, donc sans position GPS).
 */
export async function prepareAvatar(file: Blob): Promise<PreparedImage> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new MediaError("mediaType");
  }
  const side = Math.min(bitmap.width, bitmap.height);
  const size = Math.min(AVATAR_SIZE, side);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new MediaError("mediaType");
  context.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    size,
    size,
  );
  bitmap.close();
  return { blob: await encode(canvas), width: size, height: size };
}
