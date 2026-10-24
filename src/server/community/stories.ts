import "server-only";
import {
  STORY_POSTS_MAX,
  STORY_WINDOW_HOURS,
} from "@/features/community/rules";
import { contactIds } from "@/server/contacts/service";
import { db } from "@/server/db";
import {
  postSelect,
  toFeedPosts,
  type FeedAuthor,
  type FeedPost,
} from "./feed";
import { getBlockedIds } from "./members";

// « Progrès du jour » (mode Focus du Centre) : seulement des progrès que mes
// contacts ont choisi de partager dans le fil, jamais leurs habitudes privées.

export type ProgressStory = {
  author: FeedAuthor;
  /** Du plus ancien au plus récent, comme des stories. */
  posts: FeedPost[];
};

/**
 * Progrès partagés par mes contacts depuis 24 heures, regroupés par personne :
 * celle qui a partagé le plus récemment d'abord. Exclut les blocages dans les
 * deux sens et les publications masquées.
 */
export async function listProgressStories(
  viewerId: string,
  now: Date,
): Promise<ProgressStory[]> {
  const [contacts, blocked] = await Promise.all([
    contactIds(viewerId),
    getBlockedIds(viewerId),
  ]);
  const authors = [...contacts].filter((id) => !blocked.includes(id));
  if (authors.length === 0) return [];

  const rows = await db.post.findMany({
    where: {
      userId: { in: authors },
      kind: "progress",
      status: "visible",
      createdAt: {
        gte: new Date(now.getTime() - STORY_WINDOW_HOURS * 3_600_000),
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: STORY_POSTS_MAX,
    select: postSelect(viewerId, blocked),
  });

  const stories = new Map<string, ProgressStory>();
  for (const post of await toFeedPosts(rows, viewerId)) {
    const story = stories.get(post.author.id);
    if (story) story.posts.unshift(post);
    else stories.set(post.author.id, { author: post.author, posts: [post] });
  }
  return [...stories.values()];
}
