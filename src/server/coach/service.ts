import "server-only";
import {
  COACH_TOOLS,
  MAX_ACTIONS_PER_REPLY,
  coachActionPayloadSchema,
  describeActions,
  parseToolCall,
  type CoachActionPayload,
  type CoachActionView,
} from "@/features/coach/coach-tools";
import {
  COACH_HISTORY_MESSAGES,
  type CoachError,
  type CoachMessageInput,
} from "@/features/coach/limits";
import { coachInstructions } from "@/features/coach/prompts";
import { getAiProvider } from "@/server/ai/provider";
import {
  getAiProfile,
  recordAiUsage,
  releaseAiRequest,
  reserveAiRequest,
} from "@/server/ai/usage";
import { db } from "@/server/db";
import { buildCoachContext } from "./context";

// Chaque fonction reçoit l'userId de la session et filtre dessus.

export type CoachMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Propositions de la réponse (objectif, habitude, tâche, jalon). */
  actions: CoachActionView[];
};

/** Messages affichés d'une conversation : les plus récents. */
const DISPLAYED_MESSAGES = 50;

const actionSelect = {
  id: true,
  status: true,
  createdId: true,
  payload: true,
} as const;

/** Proposition lue en base, revalidée (le JSON enregistré n'est jamais cru tel quel). */
function toActionView(action: {
  id: string;
  status: CoachActionView["status"];
  createdId: string | null;
  payload: unknown;
}): CoachActionView | null {
  const payload = coachActionPayloadSchema.safeParse(action.payload);
  return payload.success
    ? {
        id: action.id,
        status: action.status,
        createdId: action.createdId,
        payload: payload.data,
      }
    : null;
}

const toActionViews = (actions: Parameters<typeof toActionView>[0][]) =>
  actions.flatMap((action) => toActionView(action) ?? []);

/** Dernière conversation de l'utilisateur, ou null s'il n'en a pas encore. */
export async function getLatestConversation(userId: string) {
  const conversation = await db.coachConversation.findFirst({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      messages: {
        orderBy: { createdAt: "desc" },
        take: DISPLAYED_MESSAGES,
        select: {
          id: true,
          role: true,
          content: true,
          actions: { orderBy: { createdAt: "asc" }, select: actionSelect },
        },
      },
    },
  });
  if (!conversation) return null;
  return {
    id: conversation.id,
    messages: conversation.messages.reverse().map((message): CoachMessage => ({
      id: message.id,
      role: message.role,
      content: message.content,
      actions: toActionViews(message.actions),
    })),
  };
}

/** Nombre de conversations enregistrées (Réglages). */
export async function countCoachConversations(userId: string) {
  return db.coachConversation.count({ where: { userId } });
}

/** Efface toutes les conversations de l'utilisateur (Réglages). */
export async function deleteCoachConversations(userId: string) {
  await db.coachConversation.deleteMany({ where: { userId } });
}

type StartedMessage = {
  ok: true;
  conversationId: string;
  /** Requêtes encore possibles aujourd'hui, celle-ci comprise. */
  remaining: number;
  /** Lance la réponse ; `onText` reçoit chaque morceau. */
  run: (
    onText: (text: string) => void,
    signal?: AbortSignal,
  ) => Promise<{
    refused: boolean;
    truncated: boolean;
    actions: CoachActionView[];
  }>;
};

/**
 * Vérifie tout (activation, accord, conversation, limite quotidienne) et
 * enregistre le message de l'utilisateur ; la réponse se lance avec `run`.
 */
export async function startCoachMessage(
  userId: string,
  input: CoachMessageInput,
): Promise<StartedMessage | { ok: false; error: CoachError }> {
  const provider = getAiProvider();
  if (!provider) return { ok: false, error: "notConfigured" };
  const profile = await getAiProfile(userId);
  if (!profile?.onboarded) return { ok: false, error: "invalid" };
  if (!profile.consented) return { ok: false, error: "consentRequired" };

  if (input.conversationId) {
    const owned = await db.coachConversation.findFirst({
      where: { id: input.conversationId, userId },
      select: { id: true },
    });
    if (!owned) return { ok: false, error: "notFound" };
  }

  const reservation = await reserveAiRequest(userId, "coach", profile.timeZone);
  if (!reservation) return { ok: false, error: "limitReached" };

  const conversationId =
    input.conversationId ??
    (
      await db.coachConversation.create({
        data: { userId, title: input.content.slice(0, 80) },
        select: { id: true },
      })
    ).id;
  await db.coachMessage.create({
    data: { conversationId, role: "user", content: input.content },
  });

  return {
    ok: true,
    conversationId,
    remaining: reservation.remaining,
    async run(onText, signal) {
      const [context, recent] = await Promise.all([
        buildCoachContext(userId, profile),
        db.coachMessage.findMany({
          where: { conversationId },
          orderBy: { createdAt: "desc" },
          take: COACH_HISTORY_MESSAGES,
          select: {
            role: true,
            content: true,
            actions: {
              orderBy: { createdAt: "asc" },
              select: actionSelect,
            },
          },
        }),
      ]);
      // Du plus ancien au plus récent ; la conversation envoyée commence par
      // l'utilisateur. Chaque réponse rappelle le sort de ses propositions.
      const turns = recent.reverse().map((message) => ({
        role: message.role,
        content: [
          message.content,
          describeActions(toActionViews(message.actions)),
        ]
          .filter(Boolean)
          .join("\n\n"),
      }));
      while (turns[0]?.role === "assistant") turns.shift();

      let streamed = false;
      let result;
      try {
        result = await provider.streamChat({
          system: {
            instructions: coachInstructions(profile.locale),
            context: context.text,
          },
          turns,
          tools: COACH_TOOLS,
          onText: (text) => {
            streamed = true;
            onText(text);
          },
          signal,
        });
      } catch (error) {
        // Rien n'a été produit : la requête ne compte pas dans la limite du jour
        if (!streamed) await releaseAiRequest(reservation.id).catch(() => {});
        throw error;
      }
      await recordAiUsage(reservation.id, result.usage);

      // Propositions valides seulement, dans la limite par réponse
      const proposals = result.toolCalls
        .map((call) => parseToolCall(call, context))
        .filter((payload): payload is CoachActionPayload => payload !== null)
        .slice(0, MAX_ACTIONS_PER_REPLY);

      let actions: CoachActionView[] = [];
      // Un refus n'est pas enregistré : il ne pèse pas sur la suite de la conversation
      if (result.text || proposals.length > 0) {
        const message = await db.coachMessage.create({
          data: { conversationId, role: "assistant", content: result.text },
          select: { id: true },
        });
        if (proposals.length > 0) {
          const created = await db.coachAction.createManyAndReturn({
            data: proposals.map((payload) => ({
              messageId: message.id,
              userId,
              kind: payload.kind,
              payload,
            })),
            select: actionSelect,
          });
          actions = toActionViews(created);
        }
      }
      await db.coachConversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });
      return { refused: result.refused, truncated: result.truncated, actions };
    },
  };
}
