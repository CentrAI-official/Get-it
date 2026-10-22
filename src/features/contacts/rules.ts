// Contacts (amis) : une demande, acceptée ou refusée par l'autre personne. La
// liste de contacts reste privée ; un contact écrit directement, sans passer
// par les demandes de message.

/** Demandes de contact envoyées par 24 heures (anti-spam). */
export const DAILY_CONTACT_REQUESTS = 50;

/**
 * Relation vue par une personne : aucune, contacts, demande envoyée, ou
 * demande reçue (à accepter).
 */
export type ContactState = "none" | "contact" | "sent" | "received";

export function contactState(
  row: { status: "pending" | "accepted"; requesterId: string } | null,
  viewerId: string,
): ContactState {
  if (!row) return "none";
  if (row.status === "accepted") return "contact";
  return row.requesterId === viewerId ? "sent" : "received";
}

export const CONTACT_ERRORS = [
  "notJoined",
  "suspended",
  "blocked",
  "notFound",
  "contactLimit",
  "unexpected",
] as const;

export type ContactError = (typeof CONTACT_ERRORS)[number];
