import { z } from "zod";

// Règles de la Messagerie (lot M1), validées avec le fondateur. Les mêmes
// limites sont garanties en base (contraintes de la migration « messages »).

export const MESSAGE_MAX_LENGTH = 2000;
/** Messages envoyés par 24 heures (anti-spam). */
export const DAILY_MESSAGE_LIMIT = 200;
/** Nouvelles conversations commencées par 24 heures. */
export const DAILY_NEW_CONVERSATION_LIMIT = 20;
/** Messages chargés à la fois dans une conversation. */
export const MESSAGE_PAGE_SIZE = 30;
/** Conversations affichées dans la boîte de réception. */
export const INBOX_SIZE = 50;

/** Rafraîchissement (pas encore de temps réel) : conversation ouverte, boîte, pastille. */
export const CONVERSATION_POLL_MS = 3000;
export const INBOX_POLL_MS = 10000;
export const UNREAD_POLL_MS = 30000;

/** Deux messages du même auteur à moins de 10 minutes forment un groupe. */
export const GROUP_GAP_MS = 10 * 60 * 1000;

/** Réactions de la Messagerie : Bravo, Force, Fier de toi, Merci. */
export const REACTIONS = ["bravo", "force", "proud", "thanks"] as const;
export type Reaction = (typeof REACTIONS)[number];
export const REACTION_EMOJI: Record<Reaction, string> = {
  bravo: "👏",
  force: "💪",
  proud: "🔥",
  thanks: "🙏",
};

/** Clé unique d'une conversation privée : les deux identifiants, triés. */
export function directKey(a: string, b: string) {
  return [a, b].sort().join(":");
}

export const messageBodySchema = z
  .string()
  .trim()
  .min(1, { error: "bodyRequired" })
  .max(MESSAGE_MAX_LENGTH, { error: "bodyTooLong" });

/** Mot facultatif qui accompagne un progrès envoyé. */
export const progressNoteSchema = z
  .string()
  .trim()
  .max(MESSAGE_MAX_LENGTH, { error: "bodyTooLong" })
  .optional()
  .default("");

export const reactionSchema = z.enum(REACTIONS).nullable();

export const memberSearchSchema = z.string().trim().min(1).max(40);

export const MESSAGE_ERRORS = [
  "bodyRequired",
  "bodyTooLong",
  "notJoined",
  "suspended",
  "blocked",
  "notFound",
  "acceptFirst",
  "requestPending",
  "messageLimit",
  "conversationLimit",
  "mediaUnavailable",
  "mediaTooMany",
  "mediaTooLarge",
  "mediaType",
  "mediaMissing",
  "videoTooLong",
  "uploadLimit",
  "unexpected",
] as const;

export type MessageError = (typeof MESSAGE_ERRORS)[number];

/** Première erreur d'une saisie, réduite aux clés de message connues. */
export function firstMessageError(error: z.ZodError): MessageError {
  const message = error.issues[0]?.message;
  return MESSAGE_ERRORS.includes(message as MessageError)
    ? (message as MessageError)
    : "unexpected";
}

export type MemberStatus = "accepted" | "request";

/**
 * Peut-on écrire dans la conversation ? Une demande doit d'abord être
 * acceptée par la personne qui la reçoit ; tant qu'elle ne l'a pas fait,
 * l'expéditeur n'envoie qu'un seul message.
 */
export function sendPermission({
  viewerStatus,
  otherStatus,
  viewerMessages,
}: {
  viewerStatus: MemberStatus;
  otherStatus: MemberStatus;
  /** Messages déjà envoyés par la personne qui écrit. */
  viewerMessages: number;
}): "ok" | "acceptFirst" | "requestPending" {
  if (viewerStatus === "request") return "acceptFirst";
  if (otherStatus === "request" && viewerMessages >= 1) {
    return "requestPending";
  }
  return "ok";
}

/** Jour du calendrier d'un instant, « AAAA-MM-JJ », dans le fuseau donné. */
export function dayOf(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

type Timed = { senderId: string; createdAt: string };

/**
 * Prépare l'affichage : un séparateur au premier message de chaque jour,
 * l'heure à la fin de chaque groupe (même auteur, moins de 10 minutes d'écart).
 */
export function layoutMessages<M extends Timed>(
  messages: readonly M[],
  timeZone: string,
): (M & { day: string | null; groupEnd: boolean })[] {
  return messages.map((message, index) => {
    const previous = messages[index - 1];
    const next = messages[index + 1];
    const day = dayOf(message.createdAt, timeZone);
    const sameGroup = (a: Timed, b: Timed) =>
      a.senderId === b.senderId &&
      dayOf(a.createdAt, timeZone) === dayOf(b.createdAt, timeZone) &&
      Math.abs(Date.parse(b.createdAt) - Date.parse(a.createdAt)) <=
        GROUP_GAP_MS;
    return {
      ...message,
      day:
        !previous || dayOf(previous.createdAt, timeZone) !== day ? day : null,
      groupEnd: !next || !sameGroup(message, next),
    };
  });
}
