import { z } from "zod";
import { PILLARS, type Pillar } from "@/config/pillars";
import { routing } from "@/i18n/routing";

// Groupes du Centre Get iT. Public : un forum (publications et commentaires),
// que tout membre du Centre trouve et rejoint. Privé : une discussion de groupe
// dans la Messagerie, sur invitation acceptée. Un pilier, ou général.
// Limites alignées sur les contraintes de la migration « groups ».

export const GROUP_NAME_MIN = 3;
export const GROUP_NAME_MAX = 60;
export const GROUP_DESCRIPTION_MAX = 500;
/** Groupes créés par une personne. */
export const MAX_OWNED_GROUPS = 10;
/** Membres d'un groupe privé (invitations comprises). */
export const MAX_PRIVATE_MEMBERS = 20;
/** Invitations envoyées par 24 heures (anti-abus). */
export const DAILY_GROUP_INVITES = 50;
/** Groupes affichés par page de l'annuaire. */
export const GROUP_PAGE_SIZE = 30;

export const GROUP_VISIBILITIES = ["public", "private"] as const;
export type GroupVisibility = (typeof GROUP_VISIBILITIES)[number];
export const GROUP_ROLES = ["owner", "admin", "member"] as const;
export type GroupRole = (typeof GROUP_ROLES)[number];

/** Pilier d'un groupe, ou « general ». */
export const GROUP_TOPICS = [...PILLARS, "general"] as const;
export type GroupTopic = (typeof GROUP_TOPICS)[number];

export const topicOf = (pillar: Pillar | null): GroupTopic =>
  pillar ?? "general";

export const GROUP_ERRORS = [
  "nameTooShort",
  "nameTooLong",
  "descriptionTooLong",
  "notJoined",
  "suspended",
  "notFound",
  "notAllowed",
  "groupLimit",
  "memberLimit",
  "inviteLimit",
  "alreadyMember",
  "blocked",
  "ownerCannotLeave",
  "unexpected",
] as const;
export type GroupError = (typeof GROUP_ERRORS)[number];

export const groupFormSchema = z.object({
  locale: z.enum(routing.locales),
  name: z
    .string()
    .trim()
    .min(GROUP_NAME_MIN, { error: "nameTooShort" })
    .max(GROUP_NAME_MAX, { error: "nameTooLong" }),
  description: z
    .string()
    .trim()
    .max(GROUP_DESCRIPTION_MAX, { error: "descriptionTooLong" }),
  topic: z.enum(GROUP_TOPICS),
  visibility: z.enum(GROUP_VISIBILITIES),
});
export type GroupFormInput = z.infer<typeof groupFormSchema>;

/** Filtres de l'annuaire, lus dans l'adresse (valeurs inconnues ignorées). */
export const groupFiltersSchema = z.object({
  topic: z.enum(GROUP_TOPICS).optional().catch(undefined),
  q: z.string().trim().min(2).max(60).optional().catch(undefined),
});
export type GroupFilters = z.infer<typeof groupFiltersSchema>;

/** Gérer les membres et les publications : le créateur et les admins. */
export const canManage = (role: GroupRole | null) =>
  role === "owner" || role === "admin";

/**
 * Peut-on retirer cette personne du groupe ? Le créateur ne part jamais ; un
 * admin ne retire que les membres ; le créateur retire tout le monde.
 */
export function canRemove(actor: GroupRole | null, target: GroupRole) {
  if (target === "owner") return false;
  if (actor === "owner") return true;
  return actor === "admin" && target === "member";
}

/** Première erreur d'une saisie, réduite aux clés connues. */
export function firstGroupError(error: z.ZodError): GroupError {
  const message = error.issues[0]?.message;
  return GROUP_ERRORS.find((key) => key === message) ?? "unexpected";
}
