import "server-only";
import {
  DAILY_UPLOAD_LIMIT,
  EXTENSIONS,
  kindOf,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  mediaSetError,
  UPLOAD_TTL_MS,
  type PostMediaInput,
  type UploadRequest,
} from "@/features/community/media";
import type { CommunityError } from "@/features/community/rules";
import { db } from "@/server/db";
import {
  createUploadUrl,
  fileInfo,
  removeFiles,
  signedUrls,
  storageEnabled,
} from "@/server/storage/service";

// Photos et vidéos des publications. Le serveur autorise chaque envoi un par
// un, vérifie le fichier envoyé avant de le joindre, et ne donne que des liens
// de lecture temporaires (compartiment privé).

export type FeedMedia = {
  kind: "image" | "video";
  url: string;
  posterUrl: string | null;
  width: number;
  height: number;
  durationMs: number | null;
};

export type UploadSlot = { uploadId: string; url: string };

/** Supprime les envois jamais utilisés de plus d'un jour (fichiers compris). */
async function dropStaleUploads(userId: string) {
  const stale = await db.mediaUpload.findMany({
    where: {
      userId,
      usedAt: null,
      createdAt: { lt: new Date(Date.now() - UPLOAD_TTL_MS) },
    },
    select: { id: true, path: true },
  });
  if (stale.length === 0) return;
  await removeFiles(stale.map((upload) => upload.path)).catch(() => undefined);
  await db.mediaUpload.deleteMany({
    where: { id: { in: stale.map((upload) => upload.id) } },
  });
}

/** Autorisations d'envoi pour les fichiers d'une future publication. */
export async function requestUploads(
  userId: string,
  files: UploadRequest,
): Promise<
  { ok: true; slots: UploadSlot[] } | { ok: false; error: CommunityError }
> {
  if (!storageEnabled()) return { ok: false, error: "mediaUnavailable" };
  const kinds = files
    .filter((file) => !file.poster)
    .map((file) => ({ kind: kindOf(file.mimeType) ?? "image" }));
  if (mediaSetError(kinds)) return { ok: false, error: "mediaTooMany" };
  for (const file of files) {
    const kind = kindOf(file.mimeType);
    const max = kind === "video" ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
    if (!kind || (file.poster && kind !== "image")) {
      return { ok: false, error: "mediaType" };
    }
    if (file.size > max) return { ok: false, error: "mediaTooLarge" };
  }
  const recent = await db.mediaUpload.count({
    where: { userId, createdAt: { gte: new Date(Date.now() - UPLOAD_TTL_MS) } },
  });
  if (recent + files.length > DAILY_UPLOAD_LIMIT) {
    return { ok: false, error: "uploadLimit" };
  }
  await dropStaleUploads(userId);

  const slots: UploadSlot[] = [];
  for (const file of files) {
    const upload = await db.mediaUpload.create({
      data: {
        userId,
        kind: kindOf(file.mimeType) ?? "image",
        mimeType: file.mimeType,
        // Chemin provisoire, remplacé par le définitif juste après (il contient l'id)
        path: `pending/${crypto.randomUUID()}`,
      },
      select: { id: true },
    });
    const path = `posts/${userId}/${upload.id}.${EXTENSIONS[file.mimeType]}`;
    await db.mediaUpload.update({ where: { id: upload.id }, data: { path } });
    slots.push({ uploadId: upload.id, url: await createUploadUrl(path) });
  }
  return { ok: true, slots };
}

export type VerifiedMedia = {
  uploadIds: string[];
  rows: {
    kind: "image" | "video";
    path: string;
    posterPath: string | null;
    width: number;
    height: number;
    durationMs: number | null;
    sizeBytes: number;
    position: number;
  }[];
};

/**
 * Vérifie les médias d'une publication : envois de l'utilisateur, récents,
 * pas encore utilisés, réellement présents dans le stockage, du bon type et
 * de la bonne taille.
 */
export async function verifyMedia(
  userId: string,
  media: PostMediaInput,
): Promise<
  { ok: true; media: VerifiedMedia } | { ok: false; error: CommunityError }
> {
  if (media.length === 0)
    return { ok: true, media: { uploadIds: [], rows: [] } };
  if (!storageEnabled()) return { ok: false, error: "mediaUnavailable" };
  const ids = [
    ...media.map((item) => item.uploadId),
    ...media.flatMap((item) =>
      item.posterUploadId ? [item.posterUploadId] : [],
    ),
  ];
  if (new Set(ids).size !== ids.length)
    return { ok: false, error: "mediaMissing" };
  const uploads = await db.mediaUpload.findMany({
    where: {
      id: { in: ids },
      userId,
      usedAt: null,
      createdAt: { gte: new Date(Date.now() - UPLOAD_TTL_MS) },
    },
    select: { id: true, kind: true, path: true, mimeType: true },
  });
  const byId = new Map(uploads.map((upload) => [upload.id, upload]));
  if (byId.size !== ids.length) return { ok: false, error: "mediaMissing" };
  if (
    mediaSetError(
      media.map((item) => ({ kind: byId.get(item.uploadId)?.kind ?? "image" })),
    )
  ) {
    return { ok: false, error: "mediaTooMany" };
  }

  const rows: VerifiedMedia["rows"] = [];
  for (const [position, item] of media.entries()) {
    const upload = byId.get(item.uploadId);
    if (!upload) return { ok: false, error: "mediaMissing" };
    const info = await fileInfo(upload.path);
    const max = upload.kind === "video" ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
    if (!info || info.size <= 0) return { ok: false, error: "mediaMissing" };
    if (info.size > max) return { ok: false, error: "mediaTooLarge" };
    if (upload.kind === "video" && !item.durationMs) {
      return { ok: false, error: "mediaType" };
    }
    const poster = item.posterUploadId
      ? byId.get(item.posterUploadId)
      : undefined;
    if (poster && (upload.kind !== "video" || poster.kind !== "image")) {
      return { ok: false, error: "mediaType" };
    }
    rows.push({
      kind: upload.kind,
      path: upload.path,
      posterPath: poster?.path ?? null,
      width: item.width,
      height: item.height,
      durationMs: upload.kind === "video" ? (item.durationMs ?? null) : null,
      sizeBytes: info.size,
      position,
    });
  }
  return { ok: true, media: { uploadIds: ids, rows } };
}

/** Médias de plusieurs publications, avec leurs liens de lecture temporaires. */
export async function mediaForPosts(postIds: string[]) {
  const byPost = new Map<string, FeedMedia[]>();
  if (postIds.length === 0) return byPost;
  const rows = await db.postMedia.findMany({
    where: { postId: { in: postIds } },
    orderBy: { position: "asc" },
    select: {
      postId: true,
      kind: true,
      path: true,
      posterPath: true,
      width: true,
      height: true,
      durationMs: true,
    },
  });
  if (rows.length === 0) return byPost;
  const urls = await signedUrls([
    ...rows.map((row) => row.path),
    ...rows.flatMap((row) => (row.posterPath ? [row.posterPath] : [])),
  ]).catch(() => new Map<string, string>());
  for (const row of rows) {
    const url = urls.get(row.path);
    if (!url) continue;
    const list = byPost.get(row.postId) ?? [];
    list.push({
      kind: row.kind,
      url,
      posterUrl: row.posterPath ? (urls.get(row.posterPath) ?? null) : null,
      width: row.width,
      height: row.height,
      durationMs: row.durationMs,
    });
    byPost.set(row.postId, list);
  }
  return byPost;
}

/** Chemins des fichiers d'une publication (à supprimer avec elle). */
export async function postMediaPaths(postId: string) {
  const rows = await db.postMedia.findMany({
    where: { postId },
    select: { path: true, posterPath: true },
  });
  return rows.flatMap((row) => [
    row.path,
    ...(row.posterPath ? [row.posterPath] : []),
  ]);
}
