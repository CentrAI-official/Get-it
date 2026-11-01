import { z } from "zod";
import { MAX_BATCH, MAX_EVENT_AGE_MS, MAX_SLICE_MS } from "./rules";
import { OVERLAY_SECTIONS, resolvePath } from "./sections";

// Événements envoyés par le navigateur (et, plus tard, par l'app mobile). Liste
// fermée : un champ inconnu ou un texte libre est refusé (strictObject). Le
// serveur déduit lui-même la section et la cible du chemin reçu.

const common = {
  /** Session de navigation, créée par le navigateur. */
  sessionId: z.uuid(),
  /** Moment de l'événement, en millisecondes depuis 1970 (heure de l'appareil). */
  at: z.number().int().positive(),
};

/** Temps actif passé sur une page, ou dans une fenêtre ouverte par-dessus. */
const timeEvent = z
  .strictObject({
    name: z.literal("time"),
    ...common,
    /** Chemin de la page, sans la requête (« /fr/community/posts/… »). */
    path: z.string().startsWith("/").max(200).optional(),
    overlay: z.enum(OVERLAY_SECTIONS).optional(),
    durationMs: z.number().int().min(1).max(MAX_SLICE_MS),
  })
  .refine(
    (event) => (event.path === undefined) !== (event.overlay === undefined),
    {
      message: "path or overlay",
    },
  );

/** Ouverture d'une fenêtre (« Ma journée », visionneuse ou studio des stories). */
const openEvent = z.strictObject({
  name: z.literal("open"),
  ...common,
  overlay: z.enum(OVERLAY_SECTIONS),
});

export const analyticsEventSchema = z.discriminatedUnion("name", [
  timeEvent,
  openEvent,
]);
export type AnalyticsClientEvent = z.infer<typeof analyticsEventSchema>;

export const analyticsBatchSchema = z.strictObject({
  events: z.array(analyticsEventSchema).min(1).max(MAX_BATCH),
});

export type AnalyticsEventRow = {
  name: AnalyticsClientEvent["name"];
  sessionId: string;
  section: string;
  route: string | null;
  target: string | null;
  durationMs: number | null;
  occurredAt: Date;
};

/**
 * Ligne à enregistrer pour un événement validé : la section et la cible sont
 * déduites du chemin ; une date hors des 24 dernières heures devient `now`.
 */
export function toEventRow(
  event: AnalyticsClientEvent,
  now: Date,
): AnalyticsEventRow {
  const resolved =
    event.name === "time" && event.path !== undefined
      ? resolvePath(event.path)
      : { section: event.overlay ?? "other", route: null, target: null };
  const age = now.getTime() - event.at;
  // Une horloge d'appareil peut avancer un peu : 5 minutes de tolérance
  const plausible = age <= MAX_EVENT_AGE_MS && age >= -5 * 60_000;
  return {
    name: event.name,
    sessionId: event.sessionId,
    section: resolved.section,
    route: resolved.route,
    target: resolved.target,
    durationMs: event.name === "time" ? event.durationMs : null,
    occurredAt: plausible ? new Date(event.at) : now,
  };
}
