// Limites de la mesure d'audience. Les listes sont alignées sur les contraintes
// de la migration 20261109120000_analytics (un test le vérifie).

/** Événements reçus du navigateur : temps actif dans une section, ouverture d'une fenêtre. */
export const ANALYTICS_EVENTS = ["time", "open"] as const;
export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];

/** Environnement d'origine (VERCEL_ENV) : la base est partagée pendant la bêta. */
export const ANALYTICS_ENVS = ["development", "preview", "production"] as const;
export type AnalyticsEnv = (typeof ANALYTICS_ENVS)[number];

/** Actions inscrites au journal des accès de l'application admin. */
export const ADMIN_AUDIT_ACTIONS = ["sign_in", "view"] as const;
export type AdminAuditAction = (typeof ADMIN_AUDIT_ACTIONS)[number];

/**
 * Fonctions classées dans le dashboard, mesurées à partir des tables
 * existantes (l'historique est donc complet). Libellés : Admin.features.names.
 */
export const ANALYTICS_FEATURES = [
  "posts",
  "shares",
  "comments",
  "likes",
  "saves",
  "stories",
  "storyViews",
  "messages",
  "contacts",
  "follows",
  "groups",
  "pacts",
  "goals",
  "tasks",
  "habits",
  "journal",
  "checkIns",
  "calendarEvents",
  "coach",
  "goalPlans",
  "developmentPlans",
  "itemEdits",
  "ranked",
  "favorites",
  "listings",
] as const;
export type AnalyticsFeature = (typeof ANALYTICS_FEATURES)[number];

/** Événements par lot envoyé par le navigateur. */
export const MAX_BATCH = 50;
/** Taille maximale d'un lot reçu, en octets. */
export const MAX_BATCH_BYTES = 32_000;
/** Une tranche de temps actif ne dépasse pas une minute (envoi toutes les 30 secondes). */
export const MAX_SLICE_MS = 60_000;
/** Au plus 600 événements par personne en 10 minutes ; le reste est ignoré. */
export const RATE_LIMIT = 600;
export const RATE_WINDOW_MS = 10 * 60_000;
/** Une date d'événement doit tomber dans les 24 dernières heures. */
export const MAX_EVENT_AGE_MS = 24 * 60 * 60_000;

/** Sans geste depuis une minute (et sans vidéo qui joue), le temps ne compte plus. */
export const IDLE_MS = 60_000;
/** Le navigateur envoie son lot toutes les 30 secondes. */
export const FLUSH_MS = 30_000;
/** Nouvelle session après 30 minutes sans activité. */
export const SESSION_GAP_MS = 30 * 60_000;

/** Les événements bruts sont effacés après 13 mois (Loi 25 : pas plus longtemps que nécessaire). */
export const RETENTION_DAYS = 396;

/** Fuseau des jours du dashboard (l'équipe et la majorité des membres sont au Québec). */
export const DASHBOARD_TIME_ZONE = "America/Toronto";

/** Périodes proposées dans le dashboard, en jours. */
export const DASHBOARD_PERIODS = [7, 30, 90] as const;
export type DashboardPeriod = (typeof DASHBOARD_PERIODS)[number];

/** Période lue dans l'adresse (?p=), 30 jours par défaut. */
export function parsePeriod(value: unknown): DashboardPeriod {
  const number = Number(Array.isArray(value) ? value[0] : value);
  return DASHBOARD_PERIODS.find((period) => period === number) ?? 30;
}
