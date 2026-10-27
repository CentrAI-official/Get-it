import "server-only";
import type { CommunityError } from "@/features/community/rules";
import { MESSAGE_ERRORS, type MessageError } from "@/features/messages/rules";
import type { FeedMedia } from "@/server/community/media";
import { db } from "@/server/db";
import { avatarUrls } from "@/server/profile/avatar";
import { removeFiles } from "@/server/storage/service";

// Photos et vidéos des messages privés : mêmes envois vérifiés que les
// publications. Les liens de lecture passent par le cache d'avatarUrls : la
// conversation ouverte se rafraîchit toutes les 3 secondes, les images ne
// doivent pas se recharger à chaque fois.

/** Erreur d'envoi (Centre) → erreur affichable de la Messagerie. */
export function messageMediaError(error: CommunityError): MessageError {
  return MESSAGE_ERRORS.find((key) => key === error) ?? "unexpected";
}

/** Médias de plusieurs messages, dans l'ordre, avec leurs liens de lecture. */
export async function messageMediaFor(messageIds: string[]) {
  const byMessage = new Map<string, FeedMedia[]>();
  if (messageIds.length === 0) return byMessage;
  const rows = await db.messageMedia.findMany({
    where: { messageId: { in: messageIds } },
    orderBy: { position: "asc" },
    select: {
      messageId: true,
      kind: true,
      path: true,
      posterPath: true,
      width: true,
      height: true,
      durationMs: true,
    },
  });
  if (rows.length === 0) return byMessage;
  const urls = await avatarUrls([
    ...rows.map((row) => row.path),
    ...rows.map((row) => row.posterPath),
  ]);
  for (const row of rows) {
    const url = urls.get(row.path);
    if (!url) continue;
    const list = byMessage.get(row.messageId) ?? [];
    list.push({
      kind: row.kind,
      url,
      posterUrl: row.posterPath ? (urls.get(row.posterPath) ?? null) : null,
      width: row.width,
      height: row.height,
      durationMs: row.durationMs,
    });
    byMessage.set(row.messageId, list);
  }
  return byMessage;
}

/** Supprime les médias d'un message (lignes et fichiers). */
export async function removeMessageMedia(messageId: string) {
  const rows = await db.messageMedia.findMany({
    where: { messageId },
    select: { path: true, posterPath: true },
  });
  if (rows.length === 0) return;
  await db.messageMedia.deleteMany({ where: { messageId } });
  await removeFiles(
    rows.flatMap((row) => [
      row.path,
      ...(row.posterPath ? [row.posterPath] : []),
    ]),
  ).catch((error: unknown) => {
    console.error("Fichiers d'un message non supprimés", error);
  });
}
