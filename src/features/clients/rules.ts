import { z } from "zod";
import {
  VISIBLE_KINDS,
  type DevelopmentKind,
} from "@/features/development/questionnaires";

// Les clients d'une page pro (lot 3, décisions du fondateur 2026-11-07). Le pro
// invite ou le client demande ; le client accepte toujours et choisit ce que
// la page voit, plan par plan ; le plan mental seulement avec un accord
// explicite. Fonctions pures, alignées sur la migration 20261122120000_page_clients.

export const CLIENT_STATUSES = [
  "invited",
  "requested",
  "active",
  "ended",
] as const;
export type ClientStatus = (typeof CLIENT_STATUSES)[number];

/** Les plans qu'un client peut montrer (le plan d'entreprise est retiré). */
export const SHAREABLE_KINDS = VISIBLE_KINDS;
export type ShareableKind = (typeof SHAREABLE_KINDS)[number];

export const CLIENT_LIMITS = {
  /** Mot joint à une invitation ou à une demande. */
  message: 300,
  note: 2000,
  /** Notes au plus par client, pour une page. */
  notesPerClient: 200,
  /** Suivis ouverts (invitations, demandes, clients) au plus par page. */
  openPerPage: 500,
  /** Invitations envoyées par une page en 24 h. */
  invitesPerDay: 50,
  /** Demandes envoyées par une personne en 24 h. */
  requestsPerDay: 20,
} as const;

export const CLIENT_ERRORS = [
  "notFound",
  "notJoined",
  "suspended",
  "self",
  "already",
  "inviteLimit",
  "requestLimit",
  "clientLimit",
  "noteLimit",
  "mentalConsentRequired",
  "messageTooLong",
  "noteRequired",
  "noteTooLong",
  "unexpected",
] as const;
export type ClientError = (typeof CLIENT_ERRORS)[number];

/**
 * Ce que le client montre : les plans choisis, et l'accord explicite si le
 * plan mental en fait partie (renseignements sensibles, Loi 25).
 */
export const sharesSchema = z
  .object({
    kinds: z
      .array(z.enum(SHAREABLE_KINDS))
      .max(SHAREABLE_KINDS.length)
      .transform((kinds) => [...new Set(kinds)]),
    mentalConsent: z.boolean().default(false),
  })
  .refine(
    (shares) => !shares.kinds.includes("mental") || shares.mentalConsent,
    {
      message: "mentalConsentRequired",
    },
  );
export type Shares = z.output<typeof sharesSchema>;

export const clientMessageSchema = z
  .string()
  .trim()
  .max(CLIENT_LIMITS.message, "messageTooLong");

export const noteSchema = z
  .string()
  .trim()
  .min(1, "noteRequired")
  .max(CLIENT_LIMITS.note, "noteTooLong");

/** Première erreur connue d'une validation, sinon « unexpected ». */
export function firstClientError(error: z.ZodError): ClientError {
  const message = error.issues[0]?.message;
  return CLIENT_ERRORS.find((key) => key === message) ?? "unexpected";
}

/**
 * La page peut-elle voir ce plan ? Seulement pendant un suivi en cours, s'il
 * est partagé, et le plan mental seulement avec l'accord explicite.
 */
export function canSeePlan(
  relation: {
    status: ClientStatus;
    sharedKinds: readonly DevelopmentKind[];
    mentalConsentAt: Date | string | null;
  },
  kind: DevelopmentKind,
) {
  return (
    relation.status === "active" &&
    relation.sharedKinds.includes(kind) &&
    (kind !== "mental" || relation.mentalConsentAt !== null)
  );
}

/** Les plans partagés, dans l'ordre de l'application (sans doublon ni plan retiré). */
export function orderedShares(kinds: readonly DevelopmentKind[]) {
  return SHAREABLE_KINDS.filter((kind) => kinds.includes(kind));
}
