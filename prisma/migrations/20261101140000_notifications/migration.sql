-- Notifications : dans l'application (cloche) et sur le téléphone (web push).
-- Une notification ne contient qu'un lien et un court sujet (nom d'un groupe,
-- titre d'un pacte) : jamais le texte d'un message.
CREATE TYPE "NotificationKind" AS ENUM ('message', 'message_request', 'contact_request', 'contact_accepted', 'group_invite', 'pact', 'comment', 'like');

CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "actor_id" UUID,
    "href" TEXT NOT NULL,
    "subject" TEXT NOT NULL DEFAULT '',
    -- Notifications regroupées (ex. plusieurs messages d'une même discussion)
    "group_key" TEXT,
    "count" INTEGER NOT NULL DEFAULT 1,
    "read_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notifications_user_id_updated_at_idx" ON "notifications"("user_id", "updated_at");
CREATE INDEX "notifications_user_id_group_key_idx" ON "notifications"("user_id", "group_key");

ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_check" CHECK (
  char_length("href") BETWEEN 1 AND 200
  AND left("href", 1) = '/'
  AND char_length("subject") <= 120
  AND "count" >= 1
);

-- Abonnements web push d'un appareil (un par navigateur)
CREATE TABLE "push_subscriptions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");
CREATE INDEX "push_subscriptions_user_id_idx" ON "push_subscriptions"("user_id");

ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_check" CHECK (
  char_length("endpoint") BETWEEN 1 AND 1000
  AND left("endpoint", 8) = 'https://'
  AND char_length("p256dh") <= 200
  AND char_length("auth") <= 100
);

-- Sécurité : RLS sans policy, comme toutes les tables (voir 20261007200000_init)
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "push_subscriptions" ENABLE ROW LEVEL SECURITY;
