-- Avis des membres et erreurs de l'application (dashboard de l'équipe).

-- Question « Qu'est-ce qui t'aide le plus? » après une semaine : répondue ou refusée
ALTER TABLE "user_settings" ADD COLUMN "feedback_prompt_at" TIMESTAMPTZ(3);

-- Avis envoyés à l'équipe ; effacés avec le compte
CREATE TABLE "feedback" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "topic" TEXT,
    "body" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_pkey" PRIMARY KEY ("id"),
    -- Alignées sur src/features/feedback/rules.ts (un test le vérifie)
    CONSTRAINT "feedback_kind_check" CHECK ("kind" IN ('idea', 'problem', 'praise', 'week')),
    CONSTRAINT "feedback_topic_check" CHECK ("topic" IS NULL OR "topic" IN ('community', 'messages', 'development', 'goals', 'journal', 'coach', 'marketplace', 'ranked')),
    CONSTRAINT "feedback_body_check" CHECK ("body" IS NULL OR char_length("body") <= 1000),
    -- Un avis libre a un texte ; une réponse d'une semaine a un sujet
    CONSTRAINT "feedback_shape_check" CHECK (
        ("kind" = 'week' AND "topic" IS NOT NULL)
        OR ("kind" <> 'week' AND "topic" IS NULL AND "body" IS NOT NULL)
    )
);
CREATE INDEX "feedback_created_at_idx" ON "feedback"("created_at");
CREATE INDEX "feedback_user_id_created_at_idx" ON "feedback"("user_id", "created_at");
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Erreurs : message nettoyé, modèle de route, jamais l'adresse complète
CREATE TABLE "app_errors" (
    "id" BIGSERIAL NOT NULL,
    "user_id" UUID,
    "source" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "digest" TEXT,
    "route" TEXT,
    "env" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_errors_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "app_errors_source_check" CHECK ("source" IN ('client', 'server')),
    CONSTRAINT "app_errors_env_check" CHECK ("env" IN ('development', 'preview', 'production')),
    CONSTRAINT "app_errors_lengths_check" CHECK (
        char_length("message") <= 300
        AND ("digest" IS NULL OR char_length("digest") <= 80)
        AND ("route" IS NULL OR char_length("route") <= 120)
    )
);
CREATE INDEX "app_errors_env_created_at_idx" ON "app_errors"("env", "created_at");
CREATE INDEX "app_errors_user_id_created_at_idx" ON "app_errors"("user_id", "created_at");
ALTER TABLE "app_errors" ADD CONSTRAINT "app_errors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Sécurité : RLS sans policy, comme toutes les tables (voir 20261007200000_init)
ALTER TABLE "feedback" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "app_errors" ENABLE ROW LEVEL SECURITY;
