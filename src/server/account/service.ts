import "server-only";
import { db } from "@/server/db";
import { removeFiles, removeUserFiles } from "@/server/storage/service";

/**
 * Les fichiers des AUTRES membres qui partent avec ce compte en base (la
 * cascade) : les publications et les événements de ses groupes, les messages
 * des conversations qu'il a commencées, de ses groupes et de sa page. Sans ça,
 * ils resteraient dans le stockage, sans plus rien qui les montre.
 */
async function othersFilesGoingWith(userId: string) {
  const [postMedia, messageMedia, events] = await Promise.all([
    db.postMedia.findMany({
      where: { post: { group: { ownerId: userId }, userId: { not: userId } } },
      select: { path: true, posterPath: true },
    }),
    db.messageMedia.findMany({
      where: {
        message: {
          senderId: { not: userId },
          conversation: {
            OR: [
              { createdById: userId },
              { group: { ownerId: userId } },
              { page: { ownerId: userId } },
            ],
          },
        },
      },
      select: { path: true, posterPath: true },
    }),
    db.communityEvent.findMany({
      where: {
        group: { ownerId: userId },
        hostId: { not: userId },
        coverPath: { not: null },
      },
      select: { coverPath: true },
    }),
  ]);
  return [
    ...[...postMedia, ...messageMedia].flatMap((row) => [
      row.path,
      ...(row.posterPath ? [row.posterPath] : []),
    ]),
    ...events.flatMap((event) => (event.coverPath ? [event.coverPath] : [])),
  ];
}

/**
 * Supprime définitivement un compte (Loi 25) : les données Get iT (le profil, et
 * par cascade les réglages, objectifs et évaluations), puis le compte Supabase
 * Auth et ses sessions. Les deux suppressions réussissent ou échouent ensemble.
 * `userId` vient toujours de la session.
 */
export async function deleteAccount(userId: string) {
  const others = await othersFilesGoingWith(userId);
  // Photos et vidéos d'abord (le stockage n'est pas couvert par la cascade)
  await removeUserFiles(userId);
  await db.$transaction([
    db.profile.deleteMany({ where: { id: userId } }),
    db.$executeRaw`DELETE FROM auth.users WHERE id = ${userId}::uuid`,
  ]);
  // Ceux des autres seulement une fois les lignes parties
  if (others.length > 0) {
    await removeFiles(others).catch((error: unknown) => {
      console.error("Fichiers liés au compte non supprimés", error);
    });
  }
}
