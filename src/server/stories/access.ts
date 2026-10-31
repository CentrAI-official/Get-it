import "server-only";
import { readOverlays } from "@/features/stories/studio";
import { getBlockedIds } from "@/server/community/members";
import { areContacts } from "@/server/contacts/service";
import { db } from "@/server/db";

// Qui peut voir une story : son auteur, et ses contacts (sans blocage dans un
// sens ou dans l'autre), tant qu'elle est en ligne et pas masquée. Partagé par
// les stories et la Messagerie (réponses à une story).

/** La story si `viewerId` peut la voir maintenant ; null sinon. */
export async function visibleStory(viewerId: string, storyId: string) {
  const story = await db.story.findFirst({
    where: { id: storyId, status: "visible", expiresAt: { gt: new Date() } },
    select: {
      id: true,
      userId: true,
      kind: true,
      path: true,
      posterPath: true,
      overlays: true,
    },
  });
  if (!story) return null;
  if (story.userId !== viewerId) {
    const [contact, blocked] = await Promise.all([
      areContacts(viewerId, story.userId),
      getBlockedIds(viewerId),
    ]);
    if (!contact || blocked.includes(story.userId)) return null;
  }
  return { ...story, overlays: readOverlays(story.overlays) };
}
