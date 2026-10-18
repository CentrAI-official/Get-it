import { z } from "zod";
import { PILLARS } from "@/config/pillars";
import { routing } from "@/i18n/routing";

// Règles du Centre Get iT (étape 9), validées avec le fondateur. Les mêmes
// limites sont garanties en base (contraintes de la migration « community »).

/** Publications et commentaires par 24 heures (anti-spam). */
export const DAILY_POST_LIMIT = 10;
export const DAILY_COMMENT_LIMIT = 50;
/** Signalements par 24 heures : évite qu'une personne inonde la modération. */
export const DAILY_REPORT_LIMIT = 20;

/** Signalements de personnes différentes qui masquent un contenu, en attendant une décision. */
export const AUTO_HIDE_REPORTS = 3;

export const POST_MAX_LENGTH = 1000;
export const COMMENT_MAX_LENGTH = 500;
export const REPORT_DETAILS_MAX_LENGTH = 500;

/** Publications chargées à la fois (« Voir plus », jamais de défilement infini). */
export const FEED_PAGE_SIZE = 20;

/** Durée d'une suspension décidée par la modération. */
export const SUSPENSION_DAYS = 7;

export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

/** Noms réservés : ils pourraient faire croire à un compte officiel. */
const RESERVED_USERNAMES = new Set([
  "admin",
  "administrateur",
  "getit",
  "get_it",
  "getitai",
  "moderateur",
  "moderator",
  "modo",
  "support",
  "staff",
  "officiel",
  "official",
]);

/** Nom d'utilisateur : minuscules, chiffres et « _ », de 3 à 20 caractères. */
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(USERNAME_PATTERN, { error: "usernameInvalid" })
  .refine((name) => !RESERVED_USERNAMES.has(name), {
    error: "usernameReserved",
  });

/** Rejoindre le Centre : nom d'utilisateur et règles acceptées. */
export const joinCommunitySchema = z.object({
  locale: z.enum(routing.locales),
  username: usernameSchema,
  rules: z.literal("on", { error: "rulesRequired" }),
});

export const postFormSchema = z.object({
  locale: z.enum(routing.locales),
  kind: z.enum(["text", "question"]),
  body: z
    .string()
    .trim()
    .min(1, { error: "bodyRequired" })
    .max(POST_MAX_LENGTH, { error: "bodyTooLong" }),
  pillar: z
    .enum(PILLARS)
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

/** Progrès à partager : une référence, revérifiée et figée par le serveur. */
export const progressShareSchema = z.object({
  locale: z.enum(routing.locales),
  source: z.discriminatedUnion("type", [
    z.object({ type: z.literal("goal"), id: z.uuid() }),
    z.object({ type: z.literal("milestone"), id: z.uuid() }),
    z.object({ type: z.literal("streak"), id: z.uuid() }),
    z.object({ type: z.literal("level") }),
    z.object({ type: z.literal("pact"), id: z.uuid() }),
  ]),
  body: z
    .string()
    .trim()
    .max(POST_MAX_LENGTH, { error: "bodyTooLong" })
    .optional()
    .default(""),
});

export const commentSchema = z
  .string()
  .trim()
  .min(1, { error: "bodyRequired" })
  .max(COMMENT_MAX_LENGTH, { error: "bodyTooLong" });

export const REPORT_REASONS = [
  "spam",
  "harassment",
  "hate",
  "self_harm",
  "inappropriate",
  "other",
] as const;

export const reportSchema = z.object({
  target: z.discriminatedUnion("type", [
    z.object({ type: z.literal("post"), id: z.uuid() }),
    z.object({ type: z.literal("comment"), id: z.uuid() }),
    z.object({ type: z.literal("user"), id: z.uuid() }),
    z.object({ type: z.literal("message"), id: z.uuid() }),
  ]),
  reason: z.enum(REPORT_REASONS),
  details: z.string().trim().max(REPORT_DETAILS_MAX_LENGTH).optional(),
});

export type ReportInput = z.infer<typeof reportSchema>;

/** Progrès figé dans une publication (affiché tel quel, même si l'objectif change). */
export const progressDataSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("goal"),
    title: z.string(),
    pillar: z.enum(PILLARS),
  }),
  z.object({
    type: z.literal("milestone"),
    title: z.string(),
    goalTitle: z.string(),
    pillar: z.enum(PILLARS),
  }),
  z.object({
    type: z.literal("streak"),
    title: z.string(),
    days: z.number().int().positive(),
    pillar: z.enum(PILLARS),
  }),
  z.object({ type: z.literal("level"), level: z.number().int().positive() }),
  z.object({
    type: z.literal("pact"),
    title: z.string(),
    days: z.number().int().positive(),
    together: z.number().int().nonnegative(),
    pillar: z.enum(PILLARS),
  }),
]);

export type ProgressData = z.infer<typeof progressDataSchema>;

/** Série minimale pour être partagée : en dessous, ce n'est pas encore un accomplissement. */
export const MIN_SHARED_STREAK = 3;

export const COMMUNITY_ERRORS = [
  "usernameInvalid",
  "usernameReserved",
  "usernameTaken",
  "rulesRequired",
  "bodyRequired",
  "bodyTooLong",
  "notJoined",
  "suspended",
  "postLimit",
  "commentLimit",
  "reportLimit",
  "notFound",
  "unexpected",
] as const;

export type CommunityError = (typeof COMMUNITY_ERRORS)[number];

export type CommunityFormState = {
  status: "idle" | "success" | "error";
  error?: CommunityError;
  values?: Record<string, string>;
};

export const initialCommunityState: CommunityFormState = { status: "idle" };

/** Première erreur d'une saisie, réduite aux clés de message connues. */
export function firstCommunityError(error: z.ZodError): CommunityError {
  const message = error.issues[0]?.message;
  return COMMUNITY_ERRORS.includes(message as CommunityError)
    ? (message as CommunityError)
    : "unexpected";
}
