import "server-only";
import type { UploadRequest } from "@/features/community/media";
import type { CommunityError } from "@/features/community/rules";
import {
  requestUploads,
  verifyMedia,
  type UploadSlot,
} from "@/server/community/media";
import { db } from "@/server/db";
import { removeFiles } from "@/server/storage/service";

// Photo d'un objectif : comme la photo de profil, un fichier du compartiment
// privé « media » (dossier posts/<userId>, supprimé avec le compte), lu par
// des liens temporaires (`avatarUrls`). Chaque fonction revérifie que
// l'objectif appartient à la personne connectée.

type PhotoResult = { ok: true } | { ok: false; error: CommunityError };

async function ownsGoal(userId: string, goalId: string) {
  const goal = await db.goal.findFirst({
    where: { id: goalId, userId },
    select: { id: true },
  });
  return goal !== null;
}

/** Autorisation d'envoi de la photo d'un objectif (une seule image). */
export async function requestGoalPhotoUpload(
  userId: string,
  goalId: string,
  files: UploadRequest,
): Promise<
  { ok: true; slots: UploadSlot[] } | { ok: false; error: CommunityError }
> {
  if (!(await ownsGoal(userId, goalId)))
    return { ok: false, error: "notFound" };
  if (
    files.length !== 1 ||
    files.some((file) => file.poster || !file.mimeType.startsWith("image/"))
  ) {
    return { ok: false, error: "mediaType" };
  }
  return requestUploads(userId, files);
}

/** Remplace la photo de l'objectif par un envoi vérifié ; l'ancienne est supprimée. */
export async function setGoalPhoto(
  userId: string,
  goalId: string,
  upload: { uploadId: string; width: number; height: number },
): Promise<PhotoResult> {
  if (!(await ownsGoal(userId, goalId)))
    return { ok: false, error: "notFound" };
  const verified = await verifyMedia(userId, [upload]);
  if (!verified.ok) return verified;
  const row = verified.media.rows[0];
  if (!row || row.kind !== "image") return { ok: false, error: "mediaType" };

  const previous = await db.$transaction(async (tx) => {
    const goal = await tx.goal.findFirst({
      where: { id: goalId, userId },
      select: { photoPath: true },
    });
    await tx.goal.updateMany({
      where: { id: goalId, userId },
      data: { photoPath: row.path },
    });
    const { count } = await tx.mediaUpload.updateMany({
      where: { id: { in: verified.media.uploadIds }, userId, usedAt: null },
      data: { usedAt: new Date() },
    });
    // Un même envoi ne sert qu'une fois
    if (count !== verified.media.uploadIds.length) {
      throw new Error("Média déjà utilisé");
    }
    return goal?.photoPath ?? null;
  });
  if (previous) await removeFiles([previous]).catch(() => undefined);
  return { ok: true };
}

/** Retire la photo de l'objectif (le fichier est supprimé) ; l'icône du pilier revient. */
export async function removeGoalPhoto(userId: string, goalId: string) {
  const goal = await db.goal.findFirst({
    where: { id: goalId, userId },
    select: { photoPath: true },
  });
  if (!goal?.photoPath) return false;
  await db.goal.updateMany({
    where: { id: goalId, userId },
    data: { photoPath: null },
  });
  await removeFiles([goal.photoPath]).catch(() => undefined);
  return true;
}
