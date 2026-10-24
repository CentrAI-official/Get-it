import "server-only";
import type { UploadRequest } from "@/features/community/media";
import type { CommunityError } from "@/features/community/rules";
import { db } from "@/server/db";
import {
  requestUploads,
  verifyMedia,
  type UploadSlot,
} from "@/server/community/media";
import { removeFiles, signedUrls } from "@/server/storage/service";

// Photo de profil : un fichier du compartiment privé « media », dans le même
// dossier que les publications (supprimé avec le compte), lu par des liens
// temporaires. Les liens sont gardés en mémoire un moment : les pages qui se
// rafraîchissent (Messagerie) ne retéléchargent pas les photos à chaque fois.

const URL_TTL_MS = 45 * 60 * 1000;
const cache = new Map<string, { url: string; expires: number }>();

/** Liens de lecture des photos (chemin → lien), depuis le cache si possible. */
export async function avatarUrls(paths: (string | null | undefined)[]) {
  const result = new Map<string, string>();
  const now = Date.now();
  const missing: string[] = [];
  for (const path of new Set(paths)) {
    if (!path) continue;
    const cached = cache.get(path);
    if (cached && cached.expires > now) result.set(path, cached.url);
    else missing.push(path);
  }
  if (missing.length > 0) {
    const fresh = await signedUrls(missing).catch(
      () => new Map<string, string>(),
    );
    for (const [path, url] of fresh) {
      cache.set(path, { url, expires: now + URL_TTL_MS });
      result.set(path, url);
    }
  }
  return result;
}

/** Lien d'une seule photo (ou null). */
export async function avatarUrl(path: string | null | undefined) {
  if (!path) return null;
  return (await avatarUrls([path])).get(path) ?? null;
}

/** Autorisation d'envoi d'une photo de profil (une seule image). */
export async function requestAvatarUpload(
  userId: string,
  files: UploadRequest,
): Promise<
  { ok: true; slots: UploadSlot[] } | { ok: false; error: CommunityError }
> {
  if (
    files.length !== 1 ||
    files.some((file) => file.poster || !file.mimeType.startsWith("image/"))
  ) {
    return { ok: false, error: "mediaType" };
  }
  return requestUploads(userId, files);
}

/** Remplace la photo de profil par un envoi vérifié ; l'ancienne est supprimée. */
export async function setAvatar(
  userId: string,
  upload: { uploadId: string; width: number; height: number },
): Promise<{ ok: true } | { ok: false; error: CommunityError }> {
  const verified = await verifyMedia(userId, [upload]);
  if (!verified.ok) return verified;
  const row = verified.media.rows[0];
  if (!row || row.kind !== "image") return { ok: false, error: "mediaType" };

  const previous = await db.$transaction(async (tx) => {
    const profile = await tx.profile.findUnique({
      where: { id: userId },
      select: { avatarPath: true },
    });
    await tx.profile.update({
      where: { id: userId },
      data: { avatarPath: row.path },
    });
    const { count } = await tx.mediaUpload.updateMany({
      where: { id: { in: verified.media.uploadIds }, userId, usedAt: null },
      data: { usedAt: new Date() },
    });
    // Un même envoi ne sert qu'une fois
    if (count !== verified.media.uploadIds.length)
      throw new Error("Média déjà utilisé");
    return profile?.avatarPath ?? null;
  });
  if (previous) {
    cache.delete(previous);
    await removeFiles([previous]).catch(() => undefined);
  }
  return { ok: true };
}

/** Retire la photo de profil (le fichier est supprimé). */
export async function removeAvatar(userId: string) {
  const profile = await db.profile.findUnique({
    where: { id: userId },
    select: { avatarPath: true },
  });
  if (!profile?.avatarPath) return false;
  await db.profile.update({
    where: { id: userId },
    data: { avatarPath: null },
  });
  cache.delete(profile.avatarPath);
  await removeFiles([profile.avatarPath]).catch(() => undefined);
  return true;
}

/** Courte présentation (vide : retirée). */
export async function setBio(userId: string, bio: string | null) {
  await db.profile.update({ where: { id: userId }, data: { bio } });
}
