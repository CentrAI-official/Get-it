import {
  coachMessageSchema,
  type CoachError,
  type CoachStreamEvent,
} from "@/features/coach/limits";
import { getSessionUser } from "@/server/auth/session";
import { startCoachMessage } from "@/server/coach/service";

const STATUS: Record<CoachError, number> = {
  notConfigured: 503,
  consentRequired: 403,
  limitReached: 429,
  invalid: 400,
  notFound: 404,
  unexpected: 500,
};

/**
 * Envoie un message à Get iT AI et renvoie la réponse au fil de l'eau, en NDJSON
 * (une ligne JSON par événement). Utilisé par le web et la future app mobile.
 */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid" }, { status: 400 });
  }
  const parsed = coachMessageSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid" }, { status: 400 });
  }

  const started = await startCoachMessage(user.id, parsed.data);
  if (!started.ok) {
    return Response.json(
      { error: started.error },
      { status: STATUS[started.error] },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const send = (event: CoachStreamEvent) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          // Le navigateur a fermé la connexion
          open = false;
        }
      };

      send({
        type: "start",
        conversationId: started.conversationId,
        remaining: started.remaining,
      });
      try {
        const result = await started.run(
          (text) => send({ type: "text", text }),
          request.signal,
        );
        if (result.actions.length > 0) {
          send({ type: "actions", actions: result.actions });
        }
        send({
          type: "done",
          refused: result.refused,
          truncated: result.truncated,
        });
      } catch (error) {
        if (!request.signal.aborted) {
          console.error("Réponse de Get iT AI impossible", error);
          send({ type: "error", error: "unexpected" });
        }
      } finally {
        open = false;
        try {
          controller.close();
        } catch {
          // Déjà fermé
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
