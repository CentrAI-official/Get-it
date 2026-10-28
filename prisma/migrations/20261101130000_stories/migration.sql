-- Stories du Centre : une photo ou une vidéo, visible 24 heures par ses
-- contacts. Le fichier vient d'un envoi vérifié (media_uploads), dans le dossier
-- posts/<userId> : il est supprimé avec la story, ou avec le compte.
CREATE TABLE "stories" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "kind" "MediaKind" NOT NULL,
    "path" TEXT NOT NULL,
    "poster_path" TEXT,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "duration_ms" INTEGER,
    "size_bytes" INTEGER NOT NULL,
    "caption" TEXT NOT NULL DEFAULT '',
    "status" "ContentStatus" NOT NULL DEFAULT 'visible',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "stories_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "stories_user_id_expires_at_idx" ON "stories"("user_id", "expires_at");
CREATE INDEX "stories_expires_at_idx" ON "stories"("expires_at");

ALTER TABLE "stories" ADD CONSTRAINT "stories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "stories" ADD CONSTRAINT "stories_check" CHECK (
  char_length("caption") <= 200
  AND "expires_at" > "created_at"
  AND "width" > 0 AND "height" > 0 AND "size_bytes" > 0
  AND (("kind" = 'video') = ("duration_ms" IS NOT NULL))
  AND ("poster_path" IS NULL OR "kind" = 'video')
);

-- Signaler une story (une seule fois par personne)
ALTER TABLE "content_reports" ADD COLUMN "story_id" UUID;
ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "content_reports_reporter_id_story_id_key" ON "content_reports"("reporter_id", "story_id");
ALTER TABLE "content_reports" DROP CONSTRAINT "content_reports_target_check";
ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_target_check" CHECK (
  num_nonnulls("post_id", "comment_id", "reported_user_id", "message_id", "story_id") = 1
  AND ("details" IS NULL OR char_length("details") <= 500)
);

-- Sécurité : RLS sans policy, comme toutes les tables (voir 20261007200000_init)
ALTER TABLE "stories" ENABLE ROW LEVEL SECURITY;
