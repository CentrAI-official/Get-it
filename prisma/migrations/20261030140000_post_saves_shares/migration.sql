-- Publications enregistrées : privé, jamais montré à l'auteur ; effacé avec
-- le compte ou la publication
CREATE TABLE "post_saves" (
    "user_id" UUID NOT NULL,
    "post_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_saves_pkey" PRIMARY KEY ("user_id", "post_id")
);

CREATE INDEX "post_saves_user_id_created_at_idx" ON "post_saves"("user_id", "created_at");
CREATE INDEX "post_saves_post_id_idx" ON "post_saves"("post_id");

ALTER TABLE "post_saves" ADD CONSTRAINT "post_saves_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "post_saves" ADD CONSTRAINT "post_saves_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Partage dans son fil : la publication d'origine (le partage disparaît avec elle)
ALTER TABLE "posts" ADD COLUMN "shared_post_id" UUID;

ALTER TABLE "posts" ADD CONSTRAINT "posts_shared_post_id_fkey" FOREIGN KEY ("shared_post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "posts_shared_post_id_idx" ON "posts"("shared_post_id");

-- Une même publication n'est partagée qu'une fois par personne
CREATE UNIQUE INDEX "posts_user_id_shared_post_id_key" ON "posts"("user_id", "shared_post_id");

-- Un partage peut être sans texte ; c'est une publication simple, sans média
ALTER TABLE "posts" DROP CONSTRAINT "posts_body_check";
ALTER TABLE "posts" ADD CONSTRAINT "posts_body_check" CHECK (
  char_length("body") <= 1000
  AND ("kind" = 'progress' OR "media_count" > 0 OR "shared_post_id" IS NOT NULL OR char_length(btrim("body")) > 0)
  AND (("kind" = 'progress') = ("progress" IS NOT NULL))
  AND ("shared_post_id" IS NULL OR ("kind" = 'text' AND "media_count" = 0 AND "shared_post_id" <> "id"))
);

-- Publication envoyée dans une conversation (le lien se vide si elle est supprimée)
ALTER TABLE "messages" ADD COLUMN "post_id" UUID;

ALTER TABLE "messages" ADD CONSTRAINT "messages_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "messages_post_id_idx" ON "messages"("post_id");

ALTER TABLE "messages" DROP CONSTRAINT "messages_body_check";
ALTER TABLE "messages" ADD CONSTRAINT "messages_body_check" CHECK (
  char_length("body") <= 2000
  AND ("kind" = 'post' OR "post_id" IS NULL)
  AND (
    "deleted_at" IS NOT NULL
    OR ("kind" = 'text' AND char_length(btrim("body")) > 0 AND "progress" IS NULL AND "pact_id" IS NULL)
    OR ("kind" = 'progress' AND "progress" IS NOT NULL AND "pact_id" IS NULL)
    OR ("kind" = 'pact' AND "pact_id" IS NOT NULL AND "body" IN ('proposed', 'ended', 'cancelled'))
    OR ("kind" = 'post' AND "progress" IS NULL AND "pact_id" IS NULL)
  )
);

-- Sécurité : RLS sans policy, comme toutes les tables (voir 20261007200000_init)
ALTER TABLE "post_saves" ENABLE ROW LEVEL SECURITY;
