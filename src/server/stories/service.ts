import "server-only";
import type { CommunityError } from "@/features/community/rules";
import { computeStreaks } from "@/features/habits/streak";
import { clampClipStart } from "@/features/stories/music";
import {
  DAILY_STORY_LIMIT,
  REPORTED_STORY_GRACE_MS,
  storyExpiry,
  STORY_TTL_MS,
  type StoryInput,
} from "@/features/stories/rules";
import {
  interactiveOf,
  readOverlays,
  type StoryOverlay,
} from "@/features/stories/studio";
import { fromDbDate, toCalendarDay } from "@/lib/dates";
import { getBlockedIds } from "@/server/community/members";
import { verifyMedia } from "@/server/community/media";
import { canParticipate } from "@/server/community/posts";
import { areContacts, contactIds } from "@/server/contacts/service";
import { db } from "@/server/db";
import { sendMessage, startConversation } from "@/server/messages/service";
import { notify } from "@/server/notifications/service";
import { avatarUrls } from "@/server/profile/avatar";
import { getUserTimeZone } from "@/server/profile/service";
import { removeFiles, signedUrls } from "@/server/storage/service";
import { visibleStory } from "./access";
import { activeTrack } from "./music";

// Stories du Centre : visibles 24 heures par les contacts de leur auteur (jamais
// par les autres membres), sans les personnes bloquées dans un sens ou dans
// l'autre. Fichiers lus par des liens temporaires (compartiment privé). Comme
// Instagram : textes et stickers, musique, sondage, question, « Vu par » pour
// l'auteur, et réponses envoyées dans la Messagerie.

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
  overlays: StoryOverlay[];
  /** Extrait de 15 s du catalogue Get iT ; null sans musique. */
  music: { title: string; artist: string; url: string; startMs: number } | null;
  /** Sondage : les votes, et le mien (montrés après avoir voté, ou à l'auteur). */
  poll: { counts: [number, number]; mine: number | null } | null;
  /** J'ai déjà répondu à la question. */
  answered: boolean;
  /** Mes stories : nombre de personnes qui l'ont vue. */
  views: number;
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
      overlays: true,
      musicStartMs: true,
      musicTrack: { select: { title: true, artist: true, path: true } },
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

  const ids = rows.map((row) => row.id);
  const mineIds = rows
    .filter((row) => row.profile.id === viewerId)
    .map((row) => row.id);
  const [urls, avatars, votes, myVotes, myAnswers, views] = await Promise.all([
    signedUrls(
      rows.flatMap((row) => [
        row.path,
        ...(row.posterPath ? [row.posterPath] : []),
        ...(row.musicTrack ? [row.musicTrack.path] : []),
      ]),
    ),
    avatarUrls(rows.map((row) => row.profile.avatarPath)),
    db.storyPollVote.groupBy({
      by: ["storyId", "choice"],
      where: { storyId: { in: ids } },
      _count: { _all: true },
    }),
    db.storyPollVote.findMany({
      where: { storyId: { in: ids }, voterId: viewerId },
      select: { storyId: true, choice: true },
    }),
    db.storyAnswer.findMany({
      where: { storyId: { in: ids }, authorId: viewerId },
      select: { storyId: true },
    }),
    db.storyView.groupBy({
      by: ["storyId"],
      where: { storyId: { in: mineIds } },
      _count: { _all: true },
    }),
  ]);
  const mineVote = new Map(myVotes.map((vote) => [vote.storyId, vote.choice]));
  const answered = new Set(myAnswers.map((answer) => answer.storyId));
  const viewCount = new Map(views.map((row) => [row.storyId, row._count._all]));

  const rings = new Map<string, StoryRing>();
  for (const row of rows) {
    const url = urls.get(row.path);
    if (!url) continue;
    const overlays = readOverlays(row.overlays);
    const musicUrl = row.musicTrack ? urls.get(row.musicTrack.path) : undefined;
    const hasPoll = overlays.some((item) => item.kind === "poll");
    const counts = (choice: number) =>
      votes.find((vote) => vote.storyId === row.id && vote.choice === choice)
        ?._count._all ?? 0;
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
      overlays,
      music:
        row.musicTrack && musicUrl
          ? {
              title: row.musicTrack.title,
              artist: row.musicTrack.artist,
              url: musicUrl,
              startMs: row.musicStartMs ?? 0,
            }
          : null,
      poll: hasPoll
        ? { counts: [counts(0), counts(1)], mine: mineVote.get(row.id) ?? null }
        : null,
      answered: answered.has(row.id),
      views: viewCount.get(row.id) ?? 0,
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

/**
 * Complète les stickers avec ce que seul le serveur connaît : le nom des
 * personnes mentionnées (des contacts, sans blocage) et la série d'une
 * habitude, figée au moment de publier.
 */
async function resolveOverlays(
  userId: string,
  overlays: StoryOverlay[],
): Promise<Result<{ overlays: StoryOverlay[] }>> {
  const blocked = await getBlockedIds(userId);
  const resolved: StoryOverlay[] = [];
  for (const item of overlays) {
    if (item.kind === "mention") {
      const [contact, person] = await Promise.all([
        areContacts(userId, item.userId),
        db.profile.findUnique({
          where: { id: item.userId },
          select: { username: true },
        }),
      ]);
      if (!contact || blocked.includes(item.userId) || !person?.username) {
        return { ok: false, error: "storyMention" };
      }
      resolved.push({ ...item, username: person.username });
    } else if (item.kind === "streak") {
      const habit = await db.habit.findFirst({
        where: { id: item.habitId, userId, archivedAt: null },
        select: {
          title: true,
          weekdays: true,
          createdAt: true,
          completions: { select: { day: true } },
        },
      });
      if (!habit) return { ok: false, error: "storyStreak" };
      const timeZone = await getUserTimeZone(userId);
      const { current } = computeStreaks({
        weekdays: habit.weekdays,
        completions: new Set(
          habit.completions.map((row) => fromDbDate(row.day)),
        ),
        startDay: toCalendarDay(habit.createdAt, timeZone),
        today: toCalendarDay(new Date(), timeZone),
      });
      resolved.push({ ...item, title: habit.title, days: current });
    } else {
      resolved.push(item);
    }
  }
  return { ok: true, overlays: resolved };
}

/** Publie une story : un média déjà envoyé et vérifié, ses textes, stickers et musique. */
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
  const resolved = await resolveOverlays(userId, input.overlays);
  if (!resolved.ok) return resolved;
  let music: { trackId: string; startMs: number } | null = null;
  if (input.music) {
    const track = await activeTrack(input.music.trackId);
    if (!track) return { ok: false, error: "storyMusic" };
    music = {
      trackId: track.id,
      startMs: clampClipStart(input.music.startMs, track.durationMs),
    };
  }
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
        overlays: resolved.overlays,
        musicTrackId: music?.trackId ?? null,
        musicStartMs: music?.startMs ?? null,
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

/** Une story d'un contact est vue (liste « Vu par » de son auteur). */
export async function recordStoryView(viewerId: string, storyId: string) {
  const story = await visibleStory(viewerId, storyId);
  if (!story || story.userId === viewerId) return false;
  await db.storyView.createMany({
    data: [{ storyId, viewerId }],
    skipDuplicates: true,
  });
  return true;
}

/** Vote au sondage d'une story (une fois) ; renvoie les votes. */
export async function votePoll(
  viewerId: string,
  storyId: string,
  choice: 0 | 1,
): Promise<Result<{ counts: [number, number]; mine: number }>> {
  const story = await visibleStory(viewerId, storyId);
  if (!story || story.userId === viewerId)
    return { ok: false, error: "notFound" };
  if (interactiveOf(story.overlays)?.kind !== "poll") {
    return { ok: false, error: "notFound" };
  }
  await db.storyPollVote.createMany({
    data: [{ storyId, voterId: viewerId, choice }],
    skipDuplicates: true,
  });
  const [votes, mine] = await Promise.all([
    db.storyPollVote.groupBy({
      by: ["choice"],
      where: { storyId },
      _count: { _all: true },
    }),
    db.storyPollVote.findUnique({
      where: { storyId_voterId: { storyId, voterId: viewerId } },
      select: { choice: true },
    }),
  ]);
  const count = (value: number) =>
    votes.find((vote) => vote.choice === value)?._count._all ?? 0;
  return {
    ok: true,
    counts: [count(0), count(1)],
    mine: mine?.choice ?? choice,
  };
}

/** Répond à la question d'une story (une réponse par personne, lue par l'auteur). */
export async function answerQuestion(
  viewerId: string,
  storyId: string,
  body: string,
): Promise<Result> {
  const allowed = await canParticipate(viewerId);
  if (!allowed.ok) return allowed;
  const story = await visibleStory(viewerId, storyId);
  if (!story || story.userId === viewerId)
    return { ok: false, error: "notFound" };
  const question = interactiveOf(story.overlays);
  if (question?.kind !== "question") return { ok: false, error: "notFound" };
  await db.storyAnswer.upsert({
    where: { storyId_authorId: { storyId, authorId: viewerId } },
    update: { body },
    create: { storyId, authorId: viewerId, body },
  });
  await notify({
    userId: story.userId,
    kind: "story",
    actorId: viewerId,
    href: "/community",
    subject: question.prompt,
    groupKey: `story:${storyId}`,
  });
  return { ok: true };
}

/** Répond à une story (texte ou réaction emoji) : le message arrive dans la Messagerie de l'auteur. */
export async function replyToStory(
  viewerId: string,
  storyId: string,
  body: string,
): Promise<Result<{ conversationId: string }>> {
  const story = await visibleStory(viewerId, storyId);
  if (!story || story.userId === viewerId)
    return { ok: false, error: "notFound" };
  const conversation = await startConversation(viewerId, story.userId);
  if (!conversation.ok) return { ok: false, error: "notFound" };
  const sent = await sendMessage(viewerId, conversation.id, {
    kind: "story",
    storyId,
    body,
  });
  return sent.ok
    ? { ok: true, conversationId: conversation.id }
    : { ok: false, error: "notFound" };
}

export type StoryActivity = {
  views: {
    id: string;
    name: string;
    username: string | null;
    avatarUrl: string | null;
    viewedAt: string;
  }[];
  poll: {
    question: string;
    options: [string, string];
    counts: [number, number];
    /** Qui a voté quoi (montré à l'auteur, comme Instagram). */
    voters: { name: string; choice: number }[];
  } | null;
  question: {
    prompt: string;
    answers: { id: string; name: string; body: string; createdAt: string }[];
  } | null;
};

/** Activité d'une de mes stories : qui l'a vue, les votes et les réponses. */
export async function getStoryActivity(
  userId: string,
  storyId: string,
): Promise<StoryActivity | null> {
  const story = await db.story.findFirst({
    where: { id: storyId, userId },
    select: { overlays: true },
  });
  if (!story) return null;
  const blocked = await getBlockedIds(userId);
  const person = {
    select: { id: true, displayName: true, username: true, avatarPath: true },
  } as const;
  const [views, votes, answers] = await Promise.all([
    db.storyView.findMany({
      where: { storyId, viewerId: { notIn: blocked } },
      orderBy: { viewedAt: "desc" },
      take: 200,
      select: { viewedAt: true, profile: person },
    }),
    db.storyPollVote.findMany({
      where: { storyId, voterId: { notIn: blocked } },
      orderBy: { createdAt: "desc" },
      select: { choice: true, profile: person },
    }),
    db.storyAnswer.findMany({
      where: { storyId, authorId: { notIn: blocked } },
      orderBy: { createdAt: "desc" },
      select: { id: true, body: true, createdAt: true, profile: person },
    }),
  ]);
  const avatars = await avatarUrls(views.map((row) => row.profile.avatarPath));
  const nameOf = (profile: {
    displayName: string | null;
    username: string | null;
  }) => profile.displayName ?? profile.username ?? "";
  const interactive = interactiveOf(readOverlays(story.overlays));
  return {
    views: views.map((row) => ({
      id: row.profile.id,
      name: nameOf(row.profile),
      username: row.profile.username,
      avatarUrl: row.profile.avatarPath
        ? (avatars.get(row.profile.avatarPath) ?? null)
        : null,
      viewedAt: row.viewedAt.toISOString(),
    })),
    poll:
      interactive?.kind === "poll"
        ? {
            question: interactive.question,
            options: interactive.options,
            counts: [
              votes.filter((vote) => vote.choice === 0).length,
              votes.filter((vote) => vote.choice === 1).length,
            ],
            voters: votes.map((vote) => ({
              name: nameOf(vote.profile),
              choice: vote.choice,
            })),
          }
        : null,
    question:
      interactive?.kind === "question"
        ? {
            prompt: interactive.prompt,
            answers: answers.map((answer) => ({
              id: answer.id,
              name: nameOf(answer.profile),
              body: answer.body,
              createdAt: answer.createdAt.toISOString(),
            })),
          }
        : null,
  };
}

/** Ce qu'on peut mentionner et montrer dans une story : contacts et séries d'habitudes. */
export async function storyStickerData(userId: string) {
  const [contacts, blocked, habits, timeZone] = await Promise.all([
    contactIds(userId),
    getBlockedIds(userId),
    db.habit.findMany({
      where: { userId, archivedAt: null },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        title: true,
        weekdays: true,
        createdAt: true,
        completions: { select: { day: true } },
      },
    }),
    getUserTimeZone(userId),
  ]);
  const people = await db.profile.findMany({
    where: {
      id: { in: [...contacts].filter((id) => !blocked.includes(id)) },
      username: { not: null },
    },
    orderBy: { username: "asc" },
    select: { id: true, username: true, displayName: true },
  });
  const today = toCalendarDay(new Date(), timeZone);
  return {
    contacts: people.map((person) => ({
      id: person.id,
      username: person.username ?? "",
      name: person.displayName ?? person.username ?? "",
    })),
    streaks: habits.map((habit) => ({
      id: habit.id,
      title: habit.title,
      days: computeStreaks({
        weekdays: habit.weekdays,
        completions: new Set(
          habit.completions.map((row) => fromDbDate(row.day)),
        ),
        startDay: toCalendarDay(habit.createdAt, timeZone),
        today,
      }).current,
    })),
  };
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
