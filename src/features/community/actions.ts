"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { recordIdSchema } from "@/features/goals/schemas";
import { requireUser } from "@/server/auth/session";
import {
  listComments,
  listFeed,
  type FeedComment,
  type FeedCursor,
  type FeedPost,
} from "@/server/community/feed";
import {
  blockUser,
  joinCommunity,
  unblockUser,
} from "@/server/community/members";
import {
  moderate,
  reportContent,
  type ModerationDecision,
} from "@/server/community/moderation";
import { requestUploads, type UploadSlot } from "@/server/community/media";
import {
  addComment,
  canParticipate,
  createPost,
  deleteComment,
  deletePost,
  setReaction,
  shareProgress,
  sharePost,
  recordVideoView,
} from "@/server/community/posts";
import { listSavedPosts, setPostSaved } from "@/server/community/saves";
import {
  commentSchema,
  firstCommunityError,
  joinCommunitySchema,
  postFormSchema,
  progressShareSchema,
  reportSchema,
  sharePostSchema,
  type CommunityError,
  type CommunityFormState,
} from "./rules";
import { postMediaSchema, uploadRequestSchema } from "./media";

// Points d'entrée publics : session, identifiants et saisies revalidés ici ;
// les services filtrent sur l'utilisateur et revérifient les permissions.

const read = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
};

function fail(error: CommunityError, values?: Record<string, string>) {
  return { status: "error" as const, error, values };
}

/** Rejoindre le Centre : nom d'utilisateur et règles acceptées. */
export async function joinCommunityAction(
  _previous: CommunityFormState,
  formData: FormData,
): Promise<CommunityFormState> {
  const user = await requireUser();
  const values = { username: read(formData, "username") };
  const parsed = joinCommunitySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(firstCommunityError(parsed.error), values);
  try {
    const joined = await joinCommunity(user.id, parsed.data.username);
    if (!joined) return fail("usernameTaken", values);
  } catch (error) {
    console.error("Inscription au Centre impossible", error);
    return fail("unexpected", values);
  }
  refresh();
  return { status: "success" };
}

/** Publication de texte ou question. */
export async function createPostAction(
  _previous: CommunityFormState,
  formData: FormData,
): Promise<CommunityFormState> {
  const user = await requireUser();
  const values = { body: read(formData, "body") };
  const parsed = postFormSchema.safeParse({
    locale: read(formData, "locale"),
    kind: read(formData, "kind"),
    body: values.body,
    pillar: read(formData, "pillar"),
  });
  if (!parsed.success) return fail(firstCommunityError(parsed.error), values);
  // Médias envoyés au préalable (identifiants d'envoi, revérifiés par le service)
  let rawMedia: unknown = [];
  try {
    rawMedia = JSON.parse(read(formData, "media") || "[]");
  } catch {
    return fail("mediaMissing", values);
  }
  const media = postMediaSchema.safeParse(rawMedia);
  if (!media.success) return fail(firstCommunityError(media.error), values);
  try {
    // Forum d'un groupe public (revérifié par le service)
    const groupId = recordIdSchema.safeParse(read(formData, "groupId"));
    const result = await createPost(user.id, {
      kind: parsed.data.kind,
      body: parsed.data.body,
      pillar: parsed.data.pillar,
      media: media.data,
      groupId: groupId.success ? groupId.data : undefined,
    });
    if (!result.ok) return fail(result.error, values);
  } catch (error) {
    console.error("Publication impossible", error);
    return fail("unexpected", values);
  }
  refresh();
  return { status: "success" };
}

/** Autorisations d'envoi pour les photos ou la vidéo d'une publication. */
export async function requestUploadsAction(
  files: unknown,
): Promise<
  { ok: true; slots: UploadSlot[] } | { ok: false; error: CommunityError }
> {
  const user = await requireUser();
  const parsed = uploadRequestSchema.safeParse(files);
  if (!parsed.success)
    return { ok: false, error: firstCommunityError(parsed.error) };
  const allowed = await canParticipate(user.id);
  if (!allowed.ok) return allowed;
  try {
    return await requestUploads(user.id, parsed.data);
  } catch (error) {
    console.error("Autorisation d'envoi impossible", error);
    return { ok: false, error: "unexpected" };
  }
}

/** Partage d'un progrès (la source est revérifiée et figée par le serveur). */
export async function shareProgressAction(
  _previous: CommunityFormState,
  formData: FormData,
): Promise<CommunityFormState> {
  const user = await requireUser();
  const values = { body: read(formData, "body") };
  let source: unknown = null;
  try {
    source = JSON.parse(read(formData, "source"));
  } catch {
    return fail("notFound", values);
  }
  const parsed = progressShareSchema.safeParse({
    locale: read(formData, "locale"),
    source,
    body: values.body,
  });
  if (!parsed.success) return fail(firstCommunityError(parsed.error), values);
  try {
    const result = await shareProgress(
      user.id,
      parsed.data.source,
      parsed.data.body,
    );
    if (!result.ok) return fail(result.error, values);
  } catch (error) {
    console.error("Partage impossible", error);
    return fail("unexpected", values);
  }
  refresh();
  return { status: "success" };
}

const cursorSchema = z.object({ createdAt: z.iso.datetime(), id: z.uuid() });

/** Page suivante du fil (« Voir plus »), ou des publications d'une personne. */
export async function loadMorePostsAction(
  cursor: FeedCursor,
  authorId?: unknown,
  groupId?: unknown,
  following?: unknown,
): Promise<{ posts: FeedPost[]; nextCursor: FeedCursor | null }> {
  const user = await requireUser();
  const parsed = cursorSchema.safeParse(cursor);
  const author =
    authorId === undefined ? undefined : z.uuid().safeParse(authorId);
  const group = groupId === undefined ? undefined : z.uuid().safeParse(groupId);
  if (
    !parsed.success ||
    (author && !author.success) ||
    (group && !group.success)
  ) {
    return { posts: [], nextCursor: null };
  }
  return listFeed(
    user.id,
    parsed.data,
    author?.data,
    group?.data,
    following === true,
  );
}

export async function deletePostAction(postId: string) {
  const user = await requireUser();
  const id = recordIdSchema.safeParse(postId);
  if (!id.success) return false;
  const deleted = await deletePost(user.id, id.data).catch(() => false);
  if (deleted) refresh();
  return deleted;
}

/** Commentaires d'une publication, ou null si elle n'est plus visible. */
export async function loadCommentsAction(
  postId: string,
): Promise<FeedComment[] | null> {
  const user = await requireUser();
  const id = recordIdSchema.safeParse(postId);
  if (!id.success) return null;
  return listComments(user.id, id.data);
}

export async function addCommentAction(
  postId: string,
  _previous: CommunityFormState,
  formData: FormData,
): Promise<CommunityFormState> {
  const user = await requireUser();
  const values = { body: read(formData, "body") };
  const id = recordIdSchema.safeParse(postId);
  const body = commentSchema.safeParse(values.body);
  if (!id.success) return fail("notFound", values);
  if (!body.success) return fail(firstCommunityError(body.error), values);
  try {
    const result = await addComment(user.id, id.data, body.data);
    if (!result.ok) return fail(result.error, values);
  } catch (error) {
    console.error("Commentaire impossible", error);
    return fail("unexpected", values);
  }
  return { status: "success" };
}

export async function deleteCommentAction(commentId: string) {
  const user = await requireUser();
  const id = recordIdSchema.safeParse(commentId);
  if (!id.success) return false;
  return deleteComment(user.id, id.data).catch(() => false);
}

/** « Bravo » : ajoute ou retire sa réaction. */
export async function setReactionAction(postId: string, on: boolean) {
  const user = await requireUser();
  const id = recordIdSchema.safeParse(postId);
  if (!id.success || typeof on !== "boolean") {
    return { ok: false as const, error: "notFound" as const };
  }
  return setReaction(user.id, id.data, on).catch(() => ({
    ok: false as const,
    error: "unexpected" as const,
  }));
}

/** Signale une publication, un commentaire ou une personne. */
export async function reportAction(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: CommunityError }> {
  const user = await requireUser();
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "notFound" };
  try {
    return await reportContent(user.id, parsed.data);
  } catch (error) {
    console.error("Signalement impossible", error);
    return { ok: false, error: "unexpected" };
  }
}

export async function blockUserAction(userId: string) {
  const user = await requireUser();
  const id = recordIdSchema.safeParse(userId);
  if (!id.success) return false;
  const blocked = await blockUser(user.id, id.data).catch(() => false);
  if (blocked) refresh();
  return blocked;
}

export async function unblockUserAction(userId: string) {
  const user = await requireUser();
  const id = recordIdSchema.safeParse(userId);
  if (!id.success) return;
  await unblockUser(user.id, id.data).catch(() => undefined);
  refresh();
}

const moderationSchema = z.object({
  target: z.object({
    type: z.enum(["post", "comment", "user", "message", "story"]),
    id: z.uuid(),
  }),
  decision: z.enum(["remove", "restore", "dismiss", "suspend", "unsuspend"]),
});

/** Décision de la modération (le rôle est revérifié par le service). */
export async function moderateAction(
  target: unknown,
  decision: ModerationDecision,
) {
  const user = await requireUser();
  const parsed = moderationSchema.safeParse({ target, decision });
  if (!parsed.success) return false;
  try {
    const done = await moderate(
      user.id,
      parsed.data.target,
      parsed.data.decision,
    );
    if (done) refresh();
    return done;
  } catch (error) {
    console.error("Décision de modération impossible", error);
    return false;
  }
}

/** Vidéo regardée au moins 2 secondes ; vrai si c'est une nouvelle vue. */
export async function recordVideoViewAction(postId: unknown) {
  const user = await requireUser();
  const id = recordIdSchema.safeParse(postId);
  if (!id.success) return false;
  return recordVideoView(user.id, id.data).catch(() => false);
}

/** Enregistre ou retire une publication (Profil › Publications › Enregistrées). */
export async function setPostSavedAction(
  postId: unknown,
  saved: unknown,
): Promise<{ ok: true } | { ok: false; error: CommunityError }> {
  const user = await requireUser();
  const id = recordIdSchema.safeParse(postId);
  const value = z.boolean().safeParse(saved);
  if (!id.success || !value.success) return { ok: false, error: "notFound" };
  try {
    return await setPostSaved(user.id, id.data, value.data);
  } catch (error) {
    console.error("Enregistrement de la publication impossible", error);
    return { ok: false, error: "unexpected" };
  }
}

/** Page suivante de mes publications enregistrées. */
export async function loadMoreSavedAction(
  cursor: unknown,
): Promise<{ posts: FeedPost[]; nextCursor: FeedCursor | null }> {
  const user = await requireUser();
  const parsed = cursorSchema.safeParse(cursor);
  if (!parsed.success) return { posts: [], nextCursor: null };
  return listSavedPosts(user.id, parsed.data);
}

/** Partage la publication de quelqu'un d'autre dans mon fil. */
export async function sharePostAction(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: CommunityError }> {
  const user = await requireUser();
  const parsed = sharePostSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstCommunityError(parsed.error) };
  }
  try {
    const result = await sharePost(
      user.id,
      parsed.data.postId,
      parsed.data.body,
    );
    if (result.ok) refresh();
    return result;
  } catch (error) {
    console.error("Partage de la publication impossible", error);
    return { ok: false, error: "unexpected" };
  }
}
