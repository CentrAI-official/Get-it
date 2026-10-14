import { z } from "zod";

/** Requêtes à Get iT AI par jour et par utilisateur (message du coach ou plan d'objectif). */
export const AI_DAILY_LIMIT = 20;

/** Longueur maximale d'un message envoyé au coach (garantie aussi par la base). */
export const COACH_MESSAGE_MAX_LENGTH = 2000;

/** Derniers messages renvoyés au modèle : borne le coût des longues conversations. */
export const COACH_HISTORY_MESSAGES = 20;

/** Corps d'une requête au coach (route /api/v1/coach/messages). */
export const coachMessageSchema = z.object({
  conversationId: z.uuid().nullable(),
  content: z.string().trim().min(1).max(COACH_MESSAGE_MAX_LENGTH),
});

export type CoachMessageInput = z.infer<typeof coachMessageSchema>;

/** Événements envoyés au navigateur, une ligne JSON chacun (NDJSON). */
export type CoachStreamEvent =
  | { type: "start"; conversationId: string; remaining: number }
  | { type: "text"; text: string }
  | { type: "done"; refused: boolean; truncated: boolean }
  | { type: "error"; error: CoachError };

export const COACH_ERRORS = [
  "notConfigured",
  "consentRequired",
  "limitReached",
  "invalid",
  "notFound",
  "unexpected",
] as const;

export type CoachError = (typeof COACH_ERRORS)[number];
