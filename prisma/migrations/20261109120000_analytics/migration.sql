-- Mesure d'audience (dashboard de l'équipe, application admin séparée) et
-- accord pour la personnalisation (profilage, Loi 25 art. 8.1 : désactivé par défaut).

-- Comptes de l'équipe ou de test exclus des statistiques
ALTER TABLE "profiles" ADD COLUMN "analytics_excluded" BOOLEAN NOT NULL DEFAULT false;
-- « Personnaliser mon expérience » dans Réglages ; null : désactivé
ALTER TABLE "user_settings" ADD COLUMN "personalization_consent_at" TIMESTAMPTZ(3);

-- Événements reçus du navigateur : jamais de texte écrit par la personne
CREATE TABLE "analytics_events" (
    "id" BIGSERIAL NOT NULL,
    "user_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "route" TEXT,
    "target" TEXT,
    "duration_ms" INTEGER,
    "env" TEXT NOT NULL,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id"),
    -- Alignées sur src/features/analytics/rules.ts (un test le vérifie)
    CONSTRAINT "analytics_events_name_check" CHECK ("name" IN ('time', 'open')),
    CONSTRAINT "analytics_events_env_check" CHECK ("env" IN ('development', 'preview', 'production')),
    CONSTRAINT "analytics_events_duration_check" CHECK ("duration_ms" IS NULL OR "duration_ms" BETWEEN 1 AND 60000),
    CONSTRAINT "analytics_events_lengths_check" CHECK (
        char_length("section") <= 64
        AND (char_length("route") <= 120 OR "route" IS NULL)
        AND (char_length("target") <= 80 OR "target" IS NULL)
    )
);
CREATE INDEX "analytics_events_env_occurred_at_idx" ON "analytics_events"("env", "occurred_at");
CREATE INDEX "analytics_events_user_id_occurred_at_idx" ON "analytics_events"("user_id", "occurred_at");
-- Limite de débit : événements reçus d'une personne dans les 10 dernières minutes
CREATE INDEX "analytics_events_user_id_created_at_idx" ON "analytics_events"("user_id", "created_at");
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Journal des accès au dashboard : qui a consulté quoi, et quand
CREATE TABLE "admin_audit_log" (
    "id" UUID NOT NULL,
    "admin_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "page" TEXT,
    "target_user_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_log_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "admin_audit_log_action_check" CHECK ("action" IN ('sign_in', 'view')),
    CONSTRAINT "admin_audit_log_page_check" CHECK (char_length("page") <= 40 OR "page" IS NULL)
);
CREATE INDEX "admin_audit_log_created_at_idx" ON "admin_audit_log"("created_at");
CREATE INDEX "admin_audit_log_target_user_id_idx" ON "admin_audit_log"("target_user_id");
ALTER TABLE "admin_audit_log" ADD CONSTRAINT "admin_audit_log_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "admin_audit_log" ADD CONSTRAINT "admin_audit_log_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Sécurité : RLS sans policy, comme toutes les tables (voir 20261007200000_init)
ALTER TABLE "analytics_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "admin_audit_log" ENABLE ROW LEVEL SECURITY;
