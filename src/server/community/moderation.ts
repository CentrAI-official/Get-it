import "server-only";
import {
  AUTO_HIDE_REPORTS,
  DAILY_REPORT_LIMIT,
  SUSPENSION_DAYS,
  type CommunityError,
  type ReportInput,
} from "@/features/community/rules";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { messageMediaFor, removeMessageMedia } from "@/server/messages/media";
import { removeFiles, signedUrls } from "@/server/storage/service";
import { mediaForPosts, type FeedMedia } from "./media";
import { getCommunityMember, isModerator } from "./members";

// Signalements et modération (§44). Les permissions sont vérifiées ici, pas
// dans l'interface (§43) : chaque décision revérifie le rôle en base.

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Signale une publication, un commentaire ou une personne. Une seule fois par
 * cible et par personne ; à partir de 3 signalements différents, le contenu est
 * masqué en attendant une décision de la modération.
 */
export async function reportContent(
  reporterId: string,
  input: ReportInput,
): Promise<{ ok: true } | { ok: false; error: CommunityError }> {
  const recent = await db.contentReport.count({
    where: { reporterId, createdAt: { gte: new Date(Date.now() - DAY_MS) } },
  });
  if (recent >= DAILY_REPORT_LIMIT) return { ok: false, error: "reportLimit" };

  const { target } = input;
  // La cible doit exister et ne pas être à soi
  const owner = await ownerOf(target, reporterId);
  if (!owner || owner === reporterId) return { ok: false, error: "notFound" };

  try {
    await db.contentReport.create({
      data: {
        reporterId,
        postId: target.type === "post" ? target.id : null,
        commentId: target.type === "comment" ? target.id : null,
        reportedUserId: target.type === "user" ? target.id : null,
        messageId: target.type === "message" ? target.id : null,
        storyId: target.type === "story" ? target.id : null,
        reason: input.reason,
        details: input.details || null,
      },
    });
  } catch (error) {
    // Déjà signalé par cette personne : rien de plus à faire
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { ok: true };
    }
    throw error;
  }

  if (target.type === "post" || target.type === "comment") {
    const where =
      target.type === "post" ? { postId: target.id } : { commentId: target.id };
    const reports = await db.contentReport.count({
      where: { ...where, status: "open" },
    });
    if (reports >= AUTO_HIDE_REPORTS) {
      if (target.type === "post") {
        await db.post.updateMany({
          where: { id: target.id, status: "visible" },
          data: { status: "hidden" },
        });
      } else {
        await db.postComment.updateMany({
          where: { id: target.id, status: "visible" },
          data: { status: "hidden" },
        });
      }
    }
  }
  if (target.type === "story") {
    const reports = await db.contentReport.count({
      where: { storyId: target.id, status: "open" },
    });
    if (reports >= AUTO_HIDE_REPORTS) {
      await db.story.updateMany({
        where: { id: target.id, status: "visible" },
        data: { status: "hidden" },
      });
    }
  }
  return { ok: true };
}

/**
 * Auteur d'un contenu (ou la personne elle-même). Un message privé n'est
 * visible, donc signalable, que par les participants de sa conversation.
 */
async function ownerOf(target: ModerationTarget, viewerId: string) {
  switch (target.type) {
    case "post":
      return (
        await db.post.findUnique({
          where: { id: target.id },
          select: { userId: true },
        })
      )?.userId;
    case "comment":
      return (
        await db.postComment.findUnique({
          where: { id: target.id },
          select: { userId: true },
        })
      )?.userId;
    case "message":
      return (
        await db.message.findFirst({
          where: {
            id: target.id,
            deletedAt: null,
            conversation: { members: { some: { userId: viewerId } } },
          },
          select: { senderId: true },
        })
      )?.senderId;
    case "story":
      return (
        await db.story.findUnique({
          where: { id: target.id },
          select: { userId: true },
        })
      )?.userId;
    case "user":
      return (
        await db.profile.findUnique({
          where: { id: target.id },
          select: { id: true },
        })
      )?.id;
  }
}

/** Vrai si l'utilisateur est modérateur (ou administrateur). */
export async function canModerate(userId: string) {
  const member = await getCommunityMember(userId);
  return Boolean(member && isModerator(member.role));
}

export type ModerationTarget = {
  type: "post" | "comment" | "user" | "message" | "story";
  id: string;
};

export type ReportedItem = {
  target: ModerationTarget;
  /** Texte signalé (publication, commentaire, message) ; null pour une personne. */
  body: string | null;
  status: "visible" | "hidden" | "removed" | null;
  author: {
    id: string;
    displayName: string | null;
    username: string | null;
    suspendedUntil: string | null;
  };
  reports: { reason: string; details: string | null; createdAt: string }[];
  /** Photos ou vidéo d'une publication signalée. */
  media: FeedMedia[];
};

/** Signalements ouverts, regroupés par contenu ou par personne. */
export async function listOpenReports(moderatorId: string) {
  if (!(await canModerate(moderatorId))) return null;
  const reports = await db.contentReport.findMany({
    where: { status: "open" },
    orderBy: { createdAt: "asc" },
    take: 300,
    select: {
      reason: true,
      details: true,
      createdAt: true,
      post: {
        select: {
          id: true,
          body: true,
          status: true,
          progress: true,
          profile: {
            select: {
              id: true,
              displayName: true,
              username: true,
              suspendedUntil: true,
            },
          },
        },
      },
      comment: {
        select: {
          id: true,
          body: true,
          status: true,
          profile: {
            select: {
              id: true,
              displayName: true,
              username: true,
              suspendedUntil: true,
            },
          },
        },
      },
      reportedUser: {
        select: {
          id: true,
          displayName: true,
          username: true,
          suspendedUntil: true,
        },
      },
      // Message privé : la modération ne voit que le message signalé
      message: {
        select: {
          id: true,
          body: true,
          deletedAt: true,
          sender: {
            select: {
              id: true,
              displayName: true,
              username: true,
              suspendedUntil: true,
            },
          },
        },
      },
      story: {
        select: {
          id: true,
          caption: true,
          status: true,
          kind: true,
          path: true,
          posterPath: true,
          width: true,
          height: true,
          durationMs: true,
          profile: {
            select: {
              id: true,
              displayName: true,
              username: true,
              suspendedUntil: true,
            },
          },
        },
      },
    },
  });

  const items = new Map<string, ReportedItem>();
  const stories = new Map<
    string,
    NonNullable<(typeof reports)[number]["story"]>
  >();
  for (const report of reports) {
    const entry = {
      reason: report.reason,
      details: report.details,
      createdAt: report.createdAt.toISOString(),
    };
    const source = report.post ?? report.comment;
    const message = report.message;
    const story = report.story;
    if (story) stories.set(story.id, story);
    const type = report.post
      ? "post"
      : report.comment
        ? "comment"
        : message
          ? "message"
          : story
            ? "story"
            : "user";
    const author =
      source?.profile ??
      message?.sender ??
      story?.profile ??
      report.reportedUser;
    const id =
      source?.id ?? message?.id ?? story?.id ?? report.reportedUser?.id;
    if (!author || !id) continue;
    const key = `${type}:${id}`;
    const item =
      items.get(key) ??
      ({
        target: { type, id },
        body: source
          ? source.body || null
          : message
            ? message.body || null
            : story
              ? story.caption || null
              : null,
        status:
          source?.status ??
          story?.status ??
          (message ? (message.deletedAt ? "removed" : "visible") : null),
        author: {
          id: author.id,
          displayName: author.displayName,
          username: author.username,
          suspendedUntil:
            author.suspendedUntil && author.suspendedUntil > new Date()
              ? author.suspendedUntil.toISOString()
              : null,
        },
        reports: [],
        media: [],
      } satisfies ReportedItem);
    item.reports.push(entry);
    items.set(key, item);
  }
  const list = [...items.values()];
  // Story signalée : sa photo ou sa vidéo, par un lien temporaire
  const storyUrls = await signedUrls(
    [...stories.values()].flatMap((story) =>
      story.posterPath ? [story.path, story.posterPath] : [story.path],
    ),
  );
  const storyMedia = (id: string): FeedMedia[] => {
    const story = stories.get(id);
    const url = story ? storyUrls.get(story.path) : undefined;
    if (!story || !url) return [];
    return [
      {
        kind: story.kind,
        url,
        posterUrl: story.posterPath
          ? (storyUrls.get(story.posterPath) ?? null)
          : null,
        width: story.width,
        height: story.height,
        durationMs: story.durationMs,
      },
    ];
  };
  const [media, messageMedia] = await Promise.all([
    mediaForPosts(
      list
        .filter((item) => item.target.type === "post")
        .map((item) => item.target.id),
    ),
    // Message privé signalé : ses photos aussi, et rien d'autre
    messageMediaFor(
      list
        .filter(
          (item) => item.target.type === "message" && item.status !== "removed",
        )
        .map((item) => item.target.id),
    ),
  ]);
  return list.map((item) =>
    item.target.type === "post"
      ? { ...item, media: media.get(item.target.id) ?? [] }
      : item.target.type === "message"
        ? { ...item, media: messageMedia.get(item.target.id) ?? [] }
        : item.target.type === "story"
          ? { ...item, media: storyMedia(item.target.id) }
          : item,
  );
}

export type ModerationDecision =
  "remove" | "restore" | "dismiss" | "suspend" | "unsuspend";

/**
 * Décision de la modération sur un contenu ou une personne. Retirer ou
 * rétablir un contenu clôt ses signalements ; suspendre bloque l'auteur
 * (publier, commenter, réagir) pendant 7 jours.
 */
export async function moderate(
  moderatorId: string,
  target: ModerationTarget,
  decision: ModerationDecision,
) {
  if (!(await canModerate(moderatorId))) return false;
  // L'auteur est retrouvé en base, jamais fourni par le navigateur
  const authorId =
    target.type === "message"
      ? (
          await db.message.findUnique({
            where: { id: target.id },
            select: { senderId: true },
          })
        )?.senderId
      : await ownerOf(target, moderatorId);
  if (!authorId) return false;
  const reportsWhere =
    target.type === "post"
      ? { postId: target.id }
      : target.type === "comment"
        ? { commentId: target.id }
        : target.type === "message"
          ? { messageId: target.id }
          : target.type === "story"
            ? { storyId: target.id }
            : { reportedUserId: target.id };
  const close = (status: "resolved" | "dismissed") =>
    db.contentReport.updateMany({
      where: { ...reportsWhere, status: "open" },
      data: { status, resolvedById: moderatorId, resolvedAt: new Date() },
    });

  if (target.type === "message" && decision === "remove") {
    // Un message retiré ne peut pas être rétabli : son contenu est effacé
    await db.$transaction([
      db.message.updateMany({
        where: { id: target.id },
        data: {
          deletedAt: new Date(),
          body: "",
          progress: Prisma.DbNull,
          mediaCount: 0,
        },
      }),
      close("resolved"),
    ]);
    await removeMessageMedia(target.id);
    return true;
  }
  if (target.type === "story" && decision === "remove") {
    // Une story retirée ne peut pas être rétablie : ses fichiers sont effacés
    const story = await db.story.findUnique({
      where: { id: target.id },
      select: { path: true, posterPath: true },
    });
    await db.$transaction([
      db.story.updateMany({
        where: { id: target.id },
        data: { status: "removed" },
      }),
      close("resolved"),
    ]);
    if (story) {
      await removeFiles(
        story.posterPath ? [story.path, story.posterPath] : [story.path],
      ).catch(() => undefined);
    }
    return true;
  }
  if (target.type === "story" && decision === "restore") {
    await db.$transaction([
      db.story.updateMany({
        where: { id: target.id, status: "hidden" },
        data: { status: "visible" },
      }),
      close("dismissed"),
    ]);
    return true;
  }
  if (decision === "remove" || decision === "restore") {
    if (target.type === "user" || target.type === "message") return false;
    const status = decision === "remove" ? "removed" : "visible";
    await db.$transaction([
      target.type === "post"
        ? db.post.updateMany({ where: { id: target.id }, data: { status } })
        : db.postComment.updateMany({
            where: { id: target.id },
            data: { status },
          }),
      close(decision === "remove" ? "resolved" : "dismissed"),
    ]);
    return true;
  }
  if (decision === "dismiss") {
    await close("dismissed");
    return true;
  }
  if (authorId === moderatorId) return false;
  await db.profile.updateMany({
    where: { id: authorId },
    data: {
      suspendedUntil:
        decision === "suspend"
          ? new Date(Date.now() + SUSPENSION_DAYS * DAY_MS)
          : null,
    },
  });
  if (decision === "suspend" && target.type === "user") await close("resolved");
  return true;
}
