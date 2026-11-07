-- Pages pro, lot 2 (décision du fondateur, 2026-11-07) : publier et répondre au
-- nom de la page, s'abonner à une page, et la boîte de messages de la page.
-- La personne qui gère la page reste l'auteure en base (modération, Loi 25),
-- mais seuls le nom et le logo de la page sont montrés.

-- Une publication ou un commentaire au nom d'une page (supprimés avec elle)
ALTER TABLE "posts" ADD COLUMN "page_id" UUID;
ALTER TABLE "posts" ADD CONSTRAINT "posts_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "posts_page_id_created_at_idx" ON "posts"("page_id", "created_at");
-- Une page publie dans le fil du Centre, jamais dans un groupe
ALTER TABLE "posts" ADD CONSTRAINT "posts_page_check" CHECK ("page_id" IS NULL OR "group_id" IS NULL);

ALTER TABLE "post_comments" ADD COLUMN "page_id" UUID;
ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Une conversation avec une page : sa boîte, à part de la Messagerie personnelle
ALTER TABLE "conversations" ADD COLUMN "page_id" UUID;
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "conversations_page_id_idx" ON "conversations"("page_id");
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_page_check" CHECK ("page_id" IS NULL OR "group_id" IS NULL);
-- Sa clé « page:<page>:<membre> » ne se confond pas avec celle de deux personnes
ALTER TABLE "conversations" DROP CONSTRAINT "conversations_direct_key_check";
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_direct_key_check" CHECK (
  "direct_key" ~ '^(page:)?[0-9a-f-]{36}:[0-9a-f-]{36}$'
);
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_page_key_check" CHECK (
  ("page_id" IS NOT NULL) = coalesce("direct_key" LIKE 'page:%', false)
);

-- Une notification envoyée au nom d'une page : on montre la page, pas la personne
ALTER TABLE "notifications" ADD COLUMN "actor_page_id" UUID;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_page_id_fkey" FOREIGN KEY ("actor_page_id") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- S'abonner à une page
CREATE TABLE "page_follows" (
    "page_id" UUID NOT NULL,
    "follower_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "page_follows_pkey" PRIMARY KEY ("page_id", "follower_id")
);
CREATE INDEX "page_follows_follower_id_created_at_idx" ON "page_follows"("follower_id", "created_at");
ALTER TABLE "page_follows" ADD CONSTRAINT "page_follows_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "page_follows" ADD CONSTRAINT "page_follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Sécurité : RLS sans policy, comme toutes les tables (voir 20261007200000_init)
ALTER TABLE "page_follows" ENABLE ROW LEVEL SECURITY;
