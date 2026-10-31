// Notifications : dans l'application (cloche) et sur le téléphone (web push).
// Une notification n'est qu'un lien et un court sujet (nom d'un groupe, titre
// d'un pacte), jamais le texte d'un message ou d'un commentaire.

export const NOTIFICATION_KINDS = [
  "message",
  "message_request",
  "contact_request",
  "contact_accepted",
  "group_invite",
  "pact",
  "comment",
  "like",
  "story",
  "follow",
] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

/** Notifications affichées au plus. */
export const NOTIFICATIONS_SHOWN = 50;
/** Les notifications lues sont effacées après 60 jours. */
export const NOTIFICATION_RETENTION_MS = 60 * 24 * 60 * 60 * 1000;
/** Rafraîchissement de la pastille de la cloche. */
export const NOTIFICATION_POLL_MS = 30_000;
export const NOTIFICATION_SUBJECT_MAX = 120;

/** Clé de texte d'une notification (espace « Notifications.items »). */
export type NotificationTextKey =
  NotificationKind | "groupMessage" | "messages" | "likes" | "comments";

/**
 * Texte d'une notification : la clé et ses valeurs. Plusieurs messages d'une
 * discussion, ou plusieurs « J'aime », sont regroupés en une seule ligne.
 */
export function notificationText(
  kind: NotificationKind,
  { name, subject, count }: { name: string; subject: string; count: number },
): {
  key: NotificationTextKey;
  values: { name: string; subject: string; count: number; others: number };
} {
  // Toutes les valeurs, toujours : chaque texte prend celles dont il a besoin
  const values = { name, subject, count, others: Math.max(0, count - 1) };
  if (kind === "message" && subject) return { key: "groupMessage", values };
  if (kind === "message" && count > 1) return { key: "messages", values };
  if (kind === "like" && count > 1) return { key: "likes", values };
  if (kind === "comment" && count > 1) return { key: "comments", values };
  return { key: kind, values };
}
