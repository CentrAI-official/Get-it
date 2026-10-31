-- Présence en ligne (vue par les contacts seulement) et abonnements.

-- Dernière activité : mise à jour au plus une fois par minute pendant que l'application est ouverte
ALTER TABLE "profiles" ADD COLUMN "last_seen_at" TIMESTAMPTZ(3);
-- Réglage « Montrer quand je suis en ligne » (comme Instagram : réciproque)
ALTER TABLE "user_settings" ADD COLUMN "show_presence" BOOLEAN NOT NULL DEFAULT true;

-- Abonnements : une ligne par personne suivie, sans acceptation
CREATE TABLE "follows" (
    "follower_id" UUID NOT NULL,
    "followed_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follows_pkey" PRIMARY KEY ("follower_id", "followed_id"),
    CONSTRAINT "follows_self_check" CHECK ("follower_id" <> "followed_id")
);
CREATE INDEX "follows_followed_id_created_at_idx" ON "follows"("followed_id", "created_at");
ALTER TABLE "follows" ADD CONSTRAINT "follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "follows" ADD CONSTRAINT "follows_followed_id_fkey" FOREIGN KEY ("followed_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Sécurité : RLS sans policy, comme toutes les tables (voir 20261007200000_init)
ALTER TABLE "follows" ENABLE ROW LEVEL SECURITY;
