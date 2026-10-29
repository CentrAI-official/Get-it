-- Vues des vidéos des publications : une par personne et par publication (au
-- moins 2 secondes regardées), jamais celles de l'auteur. Le nombre est public ;
-- qui a regardé ne l'est pas.
CREATE TABLE "post_video_views" (
    "post_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "viewed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_video_views_pkey" PRIMARY KEY ("post_id", "user_id")
);

CREATE INDEX "post_video_views_user_id_idx" ON "post_video_views"("user_id");

ALTER TABLE "post_video_views" ADD CONSTRAINT "post_video_views_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "post_video_views" ADD CONSTRAINT "post_video_views_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Sécurité : RLS sans policy, comme toutes les tables (voir 20261007200000_init)
ALTER TABLE "post_video_views" ENABLE ROW LEVEL SECURITY;
