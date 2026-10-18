-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('image', 'video');

-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "media_count" SMALLINT NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "media_uploads" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "kind" "MediaKind" NOT NULL,
    "path" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_uploads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_media" (
    "id" UUID NOT NULL,
    "post_id" UUID NOT NULL,
    "kind" "MediaKind" NOT NULL,
    "path" TEXT NOT NULL,
    "poster_path" TEXT,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "duration_ms" INTEGER,
    "size_bytes" INTEGER NOT NULL,
    "position" SMALLINT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "media_uploads_path_key" ON "media_uploads"("path");

-- CreateIndex
CREATE INDEX "media_uploads_user_id_created_at_idx" ON "media_uploads"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "post_media_post_id_position_idx" ON "post_media"("post_id", "position");

-- AddForeignKey
ALTER TABLE "media_uploads" ADD CONSTRAINT "media_uploads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_media" ADD CONSTRAINT "post_media_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Garanties en base (en plus de la validation du serveur)
ALTER TABLE "post_media" ADD CONSTRAINT "post_media_shape_check" CHECK (
  "position" BETWEEN 0 AND 3
  AND "width" > 0 AND "height" > 0
  AND "size_bytes" > 0 AND "size_bytes" <= 52428800
  AND (("kind" = 'video') = ("duration_ms" IS NOT NULL))
  AND ("duration_ms" IS NULL OR "duration_ms" <= 61000)
);
ALTER TABLE "posts" ADD CONSTRAINT "posts_media_count_check" CHECK ("media_count" BETWEEN 0 AND 4);
-- Une publication avec des médias peut être sans texte
ALTER TABLE "posts" DROP CONSTRAINT "posts_body_check";
ALTER TABLE "posts" ADD CONSTRAINT "posts_body_check" CHECK (
  char_length("body") <= 1000
  AND ("kind" = 'progress' OR "media_count" > 0 OR char_length(btrim("body")) > 0)
  AND (("kind" = 'progress') = ("progress" IS NOT NULL))
);

-- Compartiment privé des photos et vidéos : aucun accès public (pas de policy) ;
-- le serveur donne des autorisations d'envoi et des liens de lecture temporaires
INSERT INTO storage.buckets ("id", "name", "public", "file_size_limit", "allowed_mime_types")
VALUES (
  'media', 'media', false, 52428800,
  ARRAY['image/webp', 'image/jpeg', 'image/png', 'video/mp4', 'video/quicktime', 'video/webm']
)
ON CONFLICT ("id") DO NOTHING;

-- Sécurité : RLS sans policy, comme toutes les tables (voir 20261007200000_init)
ALTER TABLE "media_uploads" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "post_media" ENABLE ROW LEVEL SECURITY;
