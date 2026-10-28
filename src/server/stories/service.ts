import "server-only";
import type { CommunityError } from "@/features/community/rules";
import {
  DAILY_STORY_LIMIT,
  REPORTED_STORY_GRACE_MS,
  storyExpiry,
  STORY_TTL_MS,
  type StoryInput,
} from "@/features/stories/rules";
import { getBlockedIds } from "@/server/community/members";
import { verifyMedia } from "@/server/community/media";
import { canParticipate } from "@/server/community/posts";
import { contactIds } from "@/server/contacts/service";
import { db } from "@/server/db";
import { avatarUrls } from "@/server/profile/avatar";
import { removeFiles, signedUrls } from "@/server/storage/service";

// Stories du Centre : visibles 24 heures par les contacts de leur auteur (jamais
// par les autres membres), sans les personnes bloquées dans un sens ou dans
// l'autre. Fichiers lus par des liens temporaires (compartiment privé).

type Result<T = object> =
  ({ ok: true } & T) | { ok: false; error: CommunityError };

export type StoryItem = {
  id: string;
  kind: "image" | "video";
  url: string;
  posterUrl: string | null;
  width: number;
  height: number;
  durationMs: number | null;
  caption: string;
  createdAt: string;
};

export type StoryRing = {
  author: {
    id: string;
    displayName: string | null;
    username: string | null;
    avatarUrl: string | null;
  };
  /** Du plus ancien au plus récent, dans l'ordre de lecture. */
  stories: StoryItem[];
  latestAt: string;
};

/** Mes stories et celles de mes contacts, encore en ligne. */
export async function listStoryRings(
  viewerId: string,
  now: Date,
): Promise<{ mine: StoryRing | null; contacts: StoryRing[] }> {
  const [contacts, blocked] = await Promise.all([
    contactIds(viewerId),
    getBlockedIds(viewerId),
  ]);
  const authors = [
    viewerId,
    ...[...contacts].filter((id) => !blocked.includes(id)),
  ];
  const rows = await db.story.findMany({
    where: {
      userId: { in: authors },
      status: "visible",
      expiresAt: { gt: now },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: 300,
    select: {
      id: true,
      kind: true,
      path: true,
      posterPath: true,
      width: true,
      height: true,
      durationMs: true,
      caption: true,
      createdAt: true,
      profile: {
        select: {
          id: true,
          displayName: true,
          username: true,
          avatarPath: true,
        },
      },
    },
  });
  if (rows.length === 0) return { mine: null, contacts: [] };

  const [urls, avatars] = await Promise.all([
    signedUrls(
      rows.flatMap((row) =>
        row.posterPath ? [row.path, row.posterPath] : [row.path],
      ),
    ),
    avatarUrls(rows.map((row) => row.profile.avatarPath)),
  ]);
  const rings = new Map<string, StoryRing>();
  for (const row of rows) {
    const url = urls.get(row.path);
    if (!url) continue;
    const story: StoryItem = {
      id: row.id,
      kind: row.kind,
      url,
      posterUrl: row.posterPath ? (urls.get(row.posterPath) ?? null) : null,
      width: row.width,
      height: row.height,
      durationMs: row.durationMs,
      caption: row.caption,
      createdAt: row.createdAt.toISOString(),
    };
    const ring = rings.get(row.profile.id);
    if (ring) {
      ring.stories.push(story);
      ring.latestAt = story.createdAt;
    } else {
      const { avatarPath, ...author } = row.profile;
      rings.set(row.profile.id, {
        author: {
          ...author,
          avatarUrl: avatarPath ? (avatars.get(avatarPath) ?? null) : null,
        },
        stories: [story],
        latestAt: story.createdAt,
      });
    }
  }
  const mine = rings.get(viewerId) ?? null;
  rings.delete(viewerId);
  return { mine, contacts: [...rings.values()] };
}

/** Publie une story : un média déjà envoyé et vérifié, et une légende. */
export async function createStory(
  userId: string,
  input: StoryInput,
): Promise<Result> {
  const allowed = await canParticipate(userId);
  if (!allowed.ok) return allowed;
  const recent = await db.story.count({
    where: { userId, createdAt: { gte: new Date(Date.now() - STORY_TTL_MS) } },
  });
  if (recent >= DAILY_STORY_LIMIT) return { ok: false, error: "storyLimit" };
  const verified = await verifyMedia(userId, input.media);
  if (!verified.ok) return verified;
  const media = verified.media.rows[0];
  if (!media) return { ok: false, error: "mediaMissing" };

  const now = new Date();
  await db.$transaction([
    db.story.create({
      data: {
        userId,
        kind: media.kind,
        path: media.path,
        posterPath: media.posterPath,
        width: media.width,
        height: media.height,
        durationMs: media.durationMs,
        sizeBytes: media.sizeBytes,
        caption: input.caption,
        createdAt: now,
        expiresAt: storyExpiry(now),
      },
    }),
    db.mediaUpload.updateMany({
      where: { id: { in: verified.media.uploadIds }, userId, usedAt: null },
      data: { usedAt: now },
    }),
  ]);
  return { ok: true };
}

/** Supprime une de mes stories, avec ses fichiers. */
export async function deleteStory(
  userId: string,
  storyId: string,
): Promise<Result> {
  const story = await db.story.findFirst({
    where: { id: storyId, userId },
    select: { path: true, posterPath: true },
  });
  if (!story) return { ok: false, error: "notFound" };
  await db.story.delete({ where: { id: storyId } });
  await removeFiles(
    story.posterPath ? [story.path, story.posterPath] : [story.path],
  ).catch((error: unknown) => {
    console.error("Fichiers d'une story non supprimés", error);
  });
  return { ok: true };
}

/**
 * Efface les stories terminées et leurs fichiers, par lots. Une story signalée
 * et pas encore traitée reste 7 jours de plus pour la modération.
 */
export async function purgeExpiredStories(now: Date) {
  const expired = await db.story.findMany({
    where: {
      expiresAt: { lt: now },
      OR: [
        { reports: { none: { status: "open" } } },
        {
          expiresAt: { lt: new Date(now.getTime() - REPORTED_STORY_GRACE_MS) },
        },
      ],
    },
    take: 100,
    select: { id: true, path: true, posterPath: true },
  });
  if (expired.length === 0) return;
  await db.story.deleteMany({
    where: { id: { in: expired.map((story) => story.id) } },
  });
  await removeFiles(
    expired.flatMap((story) =>
      story.posterPath ? [story.path, story.posterPath] : [story.path],
    ),
  ).catch((error: unknown) => {
    console.error("Fichiers de stories terminées non supprimés", error);
  });
}
