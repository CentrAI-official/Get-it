"use server";

import { z } from "zod";
import { progressShareSchema } from "@/features/community/rules";
import { recordIdSchema } from "@/features/goals/schemas";
import { requireUser } from "@/server/auth/session";
import { listShareableProgress } from "@/server/community/posts";
import { countContactRequests } from "@/server/contacts/service";
import {
  cancelPact,
  listPactHabits,
  proposePact,
  respondToPact,
} from "@/server/messages/pacts";
import {
  clearConversation,
  countUnread,
  deleteMessage,
  getConversation,
  listInbox,
  listOlderMessages,
  listShareTargets,
  markRead,
  respondToRequest,
  searchMembers,
  sendMessage,
  setMessageReaction,
  startConversation,
  type ChatMessage,
  type ConversationState,
  type InboxItem,
  type MessagePerson,
  type ShareTarget,
} from "@/server/messages/service";
import {
  firstMessageError,
  memberSearchSchema,
  messageBodySchema,
  progressNoteSchema,
  reactionSchema,
  type MessageError,
} from "./rules";
import {
  PACT_ERRORS,
  pactProposalSchema,
  pactResponseSchema,
  type PactError,
} from "./pacts";

// Points d'entrée publics : session, identifiants et saisies revalidés ici ;
// le service vérifie la participation à la conversation et les blocages.

type Result<T> = ({ ok: true } & T) | { ok: false; error: MessageError };

export async function searchMembersAction(
  query: unknown,
): Promise<(MessagePerson & { contact: boolean })[]> {
  const user = await requireUser();
  const parsed = memberSearchSchema.safeParse(query);
  if (!parsed.success) return [];
  return searchMembers(user.id, parsed.data);
}

/** Ouvre (ou crée) la conversation avec un membre. */
export async function startConversationAction(
  userId: unknown,
): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  const id = recordIdSchema.safeParse(userId);
  if (!id.success) return { ok: false, error: "notFound" };
  try {
    return await startConversation(user.id, id.data);
  } catch (error) {
    console.error("Conversation impossible", error);
    return { ok: false, error: "unexpected" };
  }
}

export async function listInboxAction(): Promise<InboxItem[]> {
  const user = await requireUser();
  return (await listInbox(user.id)).items;
}

export async function countUnreadAction(): Promise<number> {
  const user = await requireUser();
  const [unread, requests] = await Promise.all([
    countUnread(user.id).catch(() => 0),
    countContactRequests(user.id).catch(() => 0),
  ]);
  return unread + requests;
}

/** État à jour d'une conversation (rafraîchissement régulier). */
export async function getConversationAction(
  conversationId: unknown,
): Promise<ConversationState | null> {
  const user = await requireUser();
  const id = recordIdSchema.safeParse(conversationId);
  if (!id.success) return null;
  return getConversation(user.id, id.data);
}

const cursorSchema = z.object({ createdAt: z.iso.datetime(), id: z.uuid() });

export async function loadOlderMessagesAction(
  conversationId: unknown,
  cursor: unknown,
): Promise<{ messages: ChatMessage[]; hasMore: boolean } | null> {
  const user = await requireUser();
  const id = recordIdSchema.safeParse(conversationId);
  const before = cursorSchema.safeParse(cursor);
  if (!id.success || !before.success) return null;
  return listOlderMessages(user.id, id.data, before.data);
}

const messageInputSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("text"), body: messageBodySchema }),
  z.object({
    kind: z.literal("progress"),
    source: progressShareSchema.shape.source,
    body: progressNoteSchema,
  }),
]);

export async function sendMessageAction(
  conversationId: unknown,
  input: unknown,
): Promise<Result<{ message: ChatMessage }>> {
  const user = await requireUser();
  const id = recordIdSchema.safeParse(conversationId);
  if (!id.success) return { ok: false, error: "notFound" };
  const parsed = messageInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstMessageError(parsed.error) };
  }
  try {
    return await sendMessage(user.id, id.data, parsed.data);
  } catch (error) {
    console.error("Envoi du message impossible", error);
    return { ok: false, error: "unexpected" };
  }
}

/** Discussions et contacts à qui envoyer une publication. */
export async function listShareTargetsAction(): Promise<ShareTarget[]> {
  const user = await requireUser();
  return listShareTargets(user.id).catch(() => []);
}

const sendPostSchema = z.object({
  postId: z.uuid(),
  to: z.union([
    z.object({ conversationId: z.uuid() }),
    z.object({ userId: z.uuid() }),
  ]),
  body: progressNoteSchema,
});

/**
 * Envoie une publication du Centre dans une discussion, ou à un contact (la
 * discussion est créée au besoin). Le serveur revérifie que l'expéditeur
 * peut lire la publication.
 */
export async function sendPostAction(
  input: unknown,
): Promise<Result<{ conversationId: string }>> {
  const user = await requireUser();
  const parsed = sendPostSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstMessageError(parsed.error) };
  }
  const { postId, to, body } = parsed.data;
  try {
    let conversationId: string;
    if ("conversationId" in to) {
      conversationId = to.conversationId;
    } else {
      const started = await startConversation(user.id, to.userId);
      if (!started.ok) return started;
      conversationId = started.id;
    }
    const sent = await sendMessage(user.id, conversationId, {
      kind: "post",
      postId,
      body,
    });
    if (!sent.ok) return sent;
    return { ok: true, conversationId };
  } catch (error) {
    console.error("Envoi de la publication impossible", error);
    return { ok: false, error: "unexpected" };
  }
}

export async function markReadAction(conversationId: unknown) {
  const user = await requireUser();
  const id = recordIdSchema.safeParse(conversationId);
  if (!id.success) return;
  await markRead(user.id, id.data).catch(() => undefined);
}

export async function respondToRequestAction(
  conversationId: unknown,
  accept: unknown,
) {
  const user = await requireUser();
  const id = recordIdSchema.safeParse(conversationId);
  if (!id.success || typeof accept !== "boolean") return false;
  return respondToRequest(user.id, id.data, accept).catch(() => false);
}

export async function deleteMessageAction(messageId: unknown) {
  const user = await requireUser();
  const id = recordIdSchema.safeParse(messageId);
  if (!id.success) return false;
  return deleteMessage(user.id, id.data).catch(() => false);
}

export async function setMessageReactionAction(
  messageId: unknown,
  kind: unknown,
) {
  const user = await requireUser();
  const id = recordIdSchema.safeParse(messageId);
  const reaction = reactionSchema.safeParse(kind);
  if (!id.success || !reaction.success) return false;
  return setMessageReaction(user.id, id.data, reaction.data).catch(() => false);
}

export async function clearConversationAction(conversationId: unknown) {
  const user = await requireUser();
  const id = recordIdSchema.safeParse(conversationId);
  if (!id.success) return false;
  return clearConversation(user.id, id.data).catch(() => false);
}

/** Progrès que l'on peut envoyer dans une conversation. */
export async function listShareableProgressAction() {
  const user = await requireUser();
  return listShareableProgress(user.id);
}

type PactResult = { ok: true } | { ok: false; error: MessageError | PactError };

/** Habitudes actives à relier à un pacte. */
export async function listPactHabitsAction() {
  const user = await requireUser();
  return listPactHabits(user.id);
}

export async function proposePactAction(
  conversationId: unknown,
  input: unknown,
): Promise<PactResult> {
  const user = await requireUser();
  const id = recordIdSchema.safeParse(conversationId);
  if (!id.success) return { ok: false, error: "notFound" };
  const parsed = pactProposalSchema.safeParse(input);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message;
    return {
      ok: false,
      error: PACT_ERRORS.includes(message as PactError)
        ? (message as PactError)
        : "unexpected",
    };
  }
  try {
    return await proposePact(user.id, id.data, parsed.data);
  } catch (error) {
    console.error("Proposition de pacte impossible", error);
    return { ok: false, error: "unexpected" };
  }
}

export async function respondPactAction(
  pactId: unknown,
  response: unknown,
): Promise<PactResult> {
  const user = await requireUser();
  const id = recordIdSchema.safeParse(pactId);
  const parsed = pactResponseSchema.safeParse(response);
  if (!id.success || !parsed.success) return { ok: false, error: "notFound" };
  try {
    return await respondToPact(user.id, id.data, parsed.data);
  } catch (error) {
    console.error("Réponse au pacte impossible", error);
    return { ok: false, error: "unexpected" };
  }
}

/** Quitter un pacte en cours, ou retirer sa proposition. */
export async function cancelPactAction(pactId: unknown) {
  const user = await requireUser();
  const id = recordIdSchema.safeParse(pactId);
  if (!id.success) return false;
  return cancelPact(user.id, id.data).catch(() => false);
}
