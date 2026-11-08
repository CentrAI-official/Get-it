-- Mode page (décision du fondateur, 2026-11-07) : on passe de son compte à sa
-- page comme sur Facebook, et tout ce qu'on fait est alors au nom de la page.

-- Une notification destinée à la page (sa cloche), pas à la personne qui la gère
ALTER TABLE "notifications" ADD COLUMN "page_id" UUID;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "notifications_page_id_updated_at_idx" ON "notifications"("page_id", "updated_at");

-- « J'aime » au nom d'une page (à part de ceux des personnes : une personne et
-- sa page peuvent aimer la même publication)
CREATE TABLE "post_page_reactions" (
    "post_id" UUID NOT NULL,
    "page_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_page_reactions_pkey" PRIMARY KEY ("post_id", "page_id")
);
CREATE INDEX "post_page_reactions_page_id_idx" ON "post_page_reactions"("page_id");
ALTER TABLE "post_page_reactions" ADD CONSTRAINT "post_page_reactions_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "post_page_reactions" ADD CONSTRAINT "post_page_reactions_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Sécurité : RLS sans policy, comme toutes les tables (voir 20261007200000_init)
ALTER TABLE "post_page_reactions" ENABLE ROW LEVEL SECURITY;
