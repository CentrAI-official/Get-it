import "server-only";
import {
  mediaSetError,
  type PostMediaInput,
  type UploadRequest,
} from "@/features/community/media";
import type { CommunityError } from "@/features/community/rules";
import { isEditableDay } from "@/features/journal/rules";
import { fromDbDate, toCalendarDay, toDbDate } from "@/lib/dates";
import {
  requestUploads,
  verifyMedia,
  type FeedMedia,
  type UploadSlot,
} from "@/server/community/media";
import { db } from "@/server/db";
import { removeFiles, signedUrls } from "@/server/storage/service";

// Photos et vidéos du journal : mêmes limites et mêmes envois vérifiés que les
// publications (4 photos ou 1 vidéo par page), mais privées comme le journal.
// Elles se modifient pendant les mêmes 7 jours que le texte, revérifiés dans
// le fuseau de l'utilisateur.

export type JournalMediaItem = FeedMedia & { id: string };

export type JournalMediaError = CommunityError | "locked";

const POSITIONS = [0, 1, 2, 3] as const;

function editable(day: string, timeZone: string) {
  return isEditableDay(day, toCalendarDay(new Date(), timeZone));
}

/** Médias d'une page, dans l'ordre, avec leurs liens de lecture temporaires. */
export async function listJournalMedia(
  userId: string,
  day: string,
): Promise<JournalMediaItem[]> {
  const rows = await db.journalMedia.findMany({
    where: { userId, day: toDbDate(day) },
    orderBy: { position: "asc" },
    select: {
      id: true,
      kind: true,
      path: true,
      posterPath: true,
      width: true,
      height: true,
      durationMs: true,
    },
  });
  if (rows.length === 0) return [];
  const urls = await signedUrls([
    ...rows.map((row) => row.path),
    ...rows.flatMap((row) => (row.posterPath ? [row.posterPath] : [])),
  ]).catch(() => new Map<string, string>());
  return rows.flatMap((row) => {
    const url = urls.get(row.path);
    if (!url) return [];
    return [
      {
        id: row.id,
        kind: row.kind,
        url,
        posterUrl: row.posterPath ? (urls.get(row.posterPath) ?? null) : null,
        width: row.width,
        height: row.height,
        durationMs: row.durationMs,
      },
    ];
  });
}

async function dayKinds(userId: string, day: string) {
  return db.journalMedia.findMany({
    where: { userId, day: toDbDate(day) },
    select: { kind: true, position: true },
  });
}

/** Autorisation d'envoi pour une page encore modifiable qui a de la place. */
export async function requestJournalUploads(
  userId: string,
  timeZone: string,
  day: string,
  files: UploadRequest,
): Promise<
  { ok: true; slots: UploadSlot[] } | { ok: false; error: JournalMediaError }
> {
  if (!editable(day, timeZone)) return { ok: false, error: "locked" };
  const existing = await dayKinds(userId, day);
  const added = files.filter((file) => !file.poster);
  if (
    mediaSetError([
      ...existing,
      ...added.map((file) => ({
        kind: file.mimeType.startsWith("video/")
          ? ("video" as const)
          : ("image" as const),
      })),
    ])
  ) {
    return { ok: false, error: "mediaTooMany" };
  }
  return requestUploads(userId, files);
}

/** Joint des envois vérifiés à la page d'un jour (la page n'a pas besoin de texte). */
export async function attachJournalMedia(
  userId: string,
  timeZone: string,
  day: string,
  media: PostMediaInput,
): Promise<{ ok: true } | { ok: false; error: JournalMediaError }> {
  if (!editable(day, timeZone)) return { ok: false, error: "locked" };
  if (media.length === 0) return { ok: true };
  const verified = await verifyMedia(userId, media);
  if (!verified.ok) return verified;

  try {
    await db.$transaction(async (tx) => {
      const existing = await tx.journalMedia.findMany({
        where: { userId, day: toDbDate(day) },
        select: { kind: true, position: true },
      });
      if (mediaSetError([...existing, ...verified.media.rows])) {
        throw new LimitError();
      }
      const taken = new Set(existing.map((row) => row.position));
      const free = POSITIONS.filter((position) => !taken.has(position));
      await tx.journalMedia.createMany({
        data: verified.media.rows.map((row, index) => ({
          userId,
          day: toDbDate(day),
          kind: row.kind,
          path: row.path,
          posterPath: row.posterPath,
          width: row.width,
          height: row.height,
          durationMs: row.durationMs,
          sizeBytes: row.sizeBytes,
          position: free[index] ?? index,
        })),
      });
      const { count } = await tx.mediaUpload.updateMany({
        where: { id: { in: verified.media.uploadIds }, userId, usedAt: null },
        data: { usedAt: new Date() },
      });
      // Un même envoi ne sert qu'une fois
      if (count !== verified.media.uploadIds.length) {
        throw new Error("Média déjà utilisé");
      }
    });
  } catch (error) {
    // Deux ajouts en même temps : l'index unique des places refuse le surplus
    if (error instanceof LimitError || isUniqueViolation(error)) {
      return { ok: false, error: "mediaTooMany" };
    }
    throw error;
  }
  return { ok: true };
}

/** Retire un média d'une page encore modifiable ; ses fichiers sont supprimés. */
export async function removeJournalMedia(
  userId: string,
  timeZone: string,
  mediaId: string,
): Promise<{ ok: true } | { ok: false; error: "notFound" | "locked" }> {
  const row = await db.journalMedia.findFirst({
    where: { id: mediaId, userId },
    select: { day: true, path: true, posterPath: true },
  });
  if (!row) return { ok: false, error: "notFound" };
  if (!editable(fromDbDate(row.day), timeZone)) {
    return { ok: false, error: "locked" };
  }
  await db.journalMedia.deleteMany({ where: { id: mediaId, userId } });
  await removeFiles([
    row.path,
    ...(row.posterPath ? [row.posterPath] : []),
  ]).catch(() => undefined);
  return { ok: true };
}

class LimitError extends Error {}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}
